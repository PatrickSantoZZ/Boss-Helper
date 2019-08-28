module.exports = function BossHelper(mod) {
	const Message = require('../tera-message')
	const MSG = new Message(mod)
	
	if (mod.proxyAuthor !== 'caali') {
		const options = require('./module').options
		if (options) {
			const settingsVersion = options.settingsVersion
			if (settingsVersion) {
				mod.settings = require('./' + (options.settingsMigrator || 'settings_migrator.js'))(mod.settings._version, settingsVersion, mod.settings)
				mod.settings._version = settingsVersion
			}
		}
	}
	
	let mobid = [],
		boss = null,
		bossName = null,
		sysMsg = null,
		bossHunting = 0,
		bossTemplate = 0
	
	mod.command.add(["boss", "怪物"], (arg) => {
		if (!arg) {
			mod.settings.enabled = !mod.settings.enabled
			MSG.chat("Boss-Helper " + (mod.settings.enabled ? MSG.BLU("开启") : MSG.YEL("关闭")))
			if (!mod.settings.enabled) {
				for (let i of mobid) {
					despawnItem(i)
				}
			}
		} else {
			switch (arg) {
				case "警告":
					mod.settings.alerted = !mod.settings.alerted
					MSG.chat("警告消息 " + (mod.settings.alerted ? MSG.BLU("启用") : MSG.YEL("禁用")))
					break
				case "通知":
					mod.settings.notice = !mod.settings.notice
					MSG.chat("通知消息 " + (mod.settings.notice ? MSG.BLU("启用") : MSG.YEL("禁用")))
					break
				case "消息":
					mod.settings.messager = !mod.settings.messager
					MSG.chat("消息记录 " + (mod.settings.messager ? MSG.BLU("启用") : MSG.YEL("禁用")))
					break
				case "标记":
					mod.settings.marker = !mod.settings.marker
					MSG.chat("标记位置 " + (mod.settings.marker ? MSG.BLU("启用") : MSG.YEL("禁用")))
					break
				case "清除":
					MSG.chat("Boss-Helper " + TIP("清除怪物标记"))
					for (let i of mobid) {
						despawnItem(i)
					}
					break
				case "查询":
					for (const info of mod.settings.bosses) {
						if (info.killedTime != null) {
							var nextTime = new Date(info.killedTime + 5*60*60*1000)
							
							if (Date.now() > (info.killedTime + 5*60*60*1000)) {
								MSG.chat(MSG.RED(info.name) + " 上次记录 " + MSG.GRY( nextTime.toLocaleString() ))
							} else {
								MSG.chat(MSG.RED(info.name) + " 下次刷新 " + MSG.TIP( nextTime.toLocaleString() ))
							}
						}
					}
					break
				default:
					MSG.chat("Boss-Helper " + MSG.RED("参数错误!"))
					break
			}
		}
	})
	
	mod.game.me.on('change_zone', (zone, quick) => {
		mobid = []
	})
	
	mod.hook('S_SPAWN_NPC', 11, (event) => {
		if (!mod.settings.enabled) return
		
		whichBoss(event.huntingZoneId, event.templateId)
		if (boss) {
			if (mod.settings.marker) {
				spawnItem(event.gameId, event.loc)
				mobid.push(event.gameId)
			}
			if (mod.settings.alerted) {
				MSG.alert(("发现 " + boss.name), 44)
			}
			if (mod.settings.notice) {
				MSG.raids("发现 " + boss.name)
			}
		}
		
		if (event.walkSpeed != 240) return;
		
		switch (event.templateId) {
			case 5001: // Ortan
				event.shapeId = 303730;
				event.templateId = 7000;
				event.huntingZoneId = 434;
				load(event);
				return true;
			case 501:  // Hazard
				event.shapeId = 303740;
				event.templateId = 77730;
				event.huntingZoneId = 777;
				load(event);
				return true;
			case 4001: // Cerrus
				event.shapeId = 303750;
				event.templateId = 1000;
				event.huntingZoneId = 994;
				load(event);
				return true;
		}
	})
	
	mod.hook('S_DESPAWN_NPC', 3, {order: -100}, (event) => {
		if (!mobid.includes(event.gameId)) return
		
		whichBoss(event.huntingZoneId, event.templateId)
		if (boss) {
			if (event.type == 5) {
				if (mod.settings.alerted) {
					MSG.alert((boss.name + " 被击杀"), 44)
				}
				if (mod.settings.notice) {
					MSG.raids(boss.name + " 被击杀")
				}
			} else if (event.type == 1) {
				if (mod.settings.alerted) {
					MSG.alert((boss.name + " ...超出范围"), 44)
				}
				if (mod.settings.notice) {
					MSG.raids(boss.name + " ...超出范围")
				}
			}
		}
		
		despawnItem(event.gameId)
		mobid.splice(mobid.indexOf(event.gameId), 1)
	})
	
	mod.hook('S_SYSTEM_MESSAGE', 1, (event) => {
		if (!mod.settings.enabled) return
		
		sysMsg = mod.parseSystemMessage(event.message)
		switch (sysMsg.id) {
			case 'SMT_FIELDBOSS_APPEAR':
				getBossMsg(sysMsg.tokens.npcName)
				whichBoss(bossHunting, bossTemplate)
				if (boss) {
					if (mod.settings.messager) {
						MSG.chat(MSG.BLU("已刷新世界BOSS ") + MSG.RED(boss.name))
						console.log(new Date().toTimeString() + " 刷新 " + boss.name)
					}
				}
				break
			case 'SMT_FIELDBOSS_DIE_GUILD':
			case 'SMT_FIELDBOSS_DIE_NOGUILD':
				getBossMsg(sysMsg.tokens.npcname)
				whichBoss(bossHunting, bossTemplate)
				if (boss) {
					if (mod.settings.messager) {
						MSG.chat(MSG.YEL(sysMsg.tokens.userName) + " 成功击杀 " + MSG.RED(boss.name))
						
						var nextTime = new Date(Date.now() + 5*60*60*1000)
						MSG.chat("下次刷新 " + MSG.TIP( nextTime.toLocaleString() ))
						
						console.log(new Date().toTimeString() + " 击杀 " + boss.name + " 下次 " + nextTime.toLocaleString())
					}
					
					for (let i=0; i < mod.settings.bosses.length; i++) {
						if (mod.settings.bosses[i].huntingZoneId == bossHunting && mod.settings.bosses[i].templateId == bossTemplate) {
							mod.settings.bosses[i].killedTime = Date.now()
							mod.settings.bosses[i].nextTime = nextTime.toLocaleString()
						}
					}
				}
				break
			default :
				break
		}
	})
	
	function getBossMsg(id) {
		switch (id) {
			case '@creature:26#5001':
				bossHunting = 26
				bossTemplate = 5001
				return
			case '@creature:39#501':
				bossHunting = 39
				bossTemplate = 501
				return
			case '@creature:51#4001':
				bossHunting = 51
				bossTemplate = 4001
				return
			default :
				bossHunting = 0
				bossTemplate = 0
				return
		}
	}
	
	function whichBoss(h_ID, t_ID) {
		if (mod.settings.bosses.find(b => b.huntingZoneId == h_ID && b.templateId == t_ID)) {
			boss = mod.settings.bosses.find(b => b.huntingZoneId == h_ID && b.templateId == t_ID)
		} else {
			boss = null
		}
	}
	
	function spawnItem(gameId, loc) {
		loc.z = loc.z - 100
		mod.send('S_SPAWN_DROPITEM', 8, {
			gameId: gameId*100n,
			loc: loc,
			item: mod.settings.itemId,
			amount: 1,
			expiry: 999999
		})
	}
	
	function despawnItem(gameId) {
		mod.send('S_DESPAWN_DROPITEM', 4, {
			gameId: gameId*100n
		})
	}
	
	// BAM-HP-Bar
	let gage_info = {
			id: 0n,
			huntingZoneId: 0,
			templateId: 0,
			target: 0n,
			unk1: 0,
			unk2: 0,
			curHp: 16000000000n,
			maxHp: 16000000000n,
			unk3: 1
		},
		hooks = []
	
	
	function update_hp() {
		mod.toClient('S_BOSS_GAGE_INFO', 3, gage_info);
	}
	// 0: 0% <= hp < 20%, 1: 20% <= hp < 40%, 2: 40% <= hp < 60%, 3: 60% <= hp < 80%, 4: 80% <= hp < 100%, 5: 100% hp
	function correct_hp(stage) {
		let boss_hp_stage = BigInt(20*(1+stage));
		// we missed some part of the fight?
		if (gage_info.curHp * 100n / gage_info.maxHp > boss_hp_stage) {
			gage_info.curHp = gage_info.maxHp * boss_hp_stage / 100n;
			update_hp();
			mod.command.message('Correcting boss hp down to <font color="#E69F00">' + String(boss_hp_stage) + '</font>%');
		}
	}
	
	function load(e) {
		gage_info.id = e.gameId;
		gage_info.curHp = gage_info.maxHp;
		correct_hp(e.hpLevel);
		if (e.mode) {
			mod.command.message('You missed ~ <font color="#E69F00">' + Math.round((99999999 - e.remainingEnrageTime)/1000) + '</font> sec. of the fight');
		}
		
		if (e.hpLevel == 5) {
			mod.command.message("BAM is at full 100% hp, nobody touched it");
		} else if (e.hpLevel == 0) {
			mod.command.message("BAM is likely far below 20% hp, it may die any moment now");
		}
		
		if (!hooks.length) {
			setTimeout(update_hp, 1000);
			hook('S_NPC_STATUS', 2, (event) => {
				if (event.gameId === gage_info.id) {
					correct_hp(event.hpLevel);
				}
			});
			
			hook('S_EACH_SKILL_RESULT', 13, (event) => {
				if (event.target === gage_info.id && event.type === 1) {
					gage_info.curHp -= event.value;
					update_hp();
				}
			});
			
			hook('S_DESPAWN_NPC', 3, (event) => {
				if (event.gameId === gage_info.id) {
					unload();
				}
			});
		}
	}
	
	function unload() {
		if (hooks.length) {
			for (let h of hooks) {
				mod.unhook(h);
			}
			hooks = []
		}
	}
	
	function hook() {
		hooks.push(mod.hook(...arguments));
	}
	
}