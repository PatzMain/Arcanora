import { describe, it, expect } from 'vitest';
import {
  createInitialSectors,
  createInitialDoors,
  canUnlockDoor,
  unlockDoor,
  repairDoor,
  repairTerminal,
  createInitialComrades,
  assignComradeRole,
  processComradeTick,
  healComrade,
  createInitialPlayerState,
  WEAPON_DEFINITIONS,
  canOverclockWeapon,
  overclockWeapon,
  canBuyPerk,
  buyPerk,
  calculateShotDamage,
  applyEnemyDamageToPlayer,
  createEnemy,
  generateWaveEnemies,
  triggerEmpDischarge,
  createInitialRaidState,
  updateRaidThreatTick,
  processBreachDamageTick,
  repelRaid,
  revivePlayerAtClinic,
  createInitialCyberpunkGameState,
} from '../packages/core/src/cyberpunk/index.js';

describe('Sector 0: Cyberpunk Domain Engine', () => {
  describe('Sectors & Spatial Blast Doors', () => {
    it('initializes default platform 04 and connected doors', () => {
      const state = createInitialCyberpunkGameState();
      expect(state.sectors.platform_04.unlocked).toBe(true);
      expect(state.sectors.sector_01_power.unlocked).toBe(false);
      expect(state.doors.door_power_substation.unlocked).toBe(false);
    });

    it('prevents unlocking a door without sufficient credits or scrap', () => {
      const state = createInitialCyberpunkGameState();
      state.player.credits = 100; // needs 350
      const check = canUnlockDoor(state, 'door_power_substation');
      expect(check.canUnlock).toBe(false);
      expect(check.reason).toContain('Insufficient Credits');
    });

    it('prevents unlocking a disconnected door when adjacent sectors are locked', () => {
      const state = createInitialCyberpunkGameState();
      state.player.credits = 5000;
      state.player.decryptKeys = 5;
      // door_deep_vault connects sector_04 and sector_05, both are locked initially
      const check = canUnlockDoor(state, 'door_deep_vault');
      expect(check.canUnlock).toBe(false);
      expect(check.reason).toContain('Requires access to adjacent sector');
    });

    it('successfully unlocks connected door, deducts resources, and unlocks destination sector', () => {
      const state = createInitialCyberpunkGameState();
      state.player.credits = 500;
      const res = unlockDoor(state, 'door_power_substation');
      expect(res.success).toBe(true);
      expect(res.newState.doors.door_power_substation.unlocked).toBe(true);
      expect(res.newState.sectors.sector_01_power.unlocked).toBe(true);
      expect(res.newState.player.credits).toBe(150); // 500 - 350
      expect(res.newState.stats.doorsUnlocked).toBe(1);
    });

    it('repairs damaged blast doors with tech scrap', () => {
      const state = createInitialCyberpunkGameState();
      state.doors.door_power_substation.integrity = 50;
      state.player.scrap = 20;

      const res = repairDoor(state, 'door_power_substation', 10);
      expect(res.success).toBe(true);
      expect(res.newState.doors.door_power_substation.integrity).toBe(100);
      expect(res.newState.player.scrap).toBe(10);
    });

    it('repairs broken terminals', () => {
      const state = createInitialCyberpunkGameState();
      state.sectors.platform_04.terminals[0].operational = false;
      state.player.scrap = 50;

      const res = repairTerminal(state, 'platform_04', 'term_hub_generator');
      expect(res.success).toBe(true);
      expect(res.newState.sectors.platform_04.terminals[0].operational).toBe(true);
      expect(res.newState.player.scrap).toBe(40);
    });
  });

  describe('Comrades & Tycoon Automation', () => {
    it('processes tick resource generation for Scrappers and Netrunners', () => {
      const state = createInitialCyberpunkGameState();
      state.player.credits = 0;
      state.player.scrap = 0;

      // Jax Vance is active as scrapper in platform_04
      const tick = processComradeTick(state, 10);
      expect(tick.newState.player.scrap).toBeGreaterThan(0);
      expect(tick.summary.scrapEarned).toBeGreaterThan(0);
    });

    it('enforces maximum comrade capacity per sector', () => {
      const state = createInitialCyberpunkGameState();
      // Unlock sector 1 which has maxComrades: 2
      state.sectors.sector_01_power.unlocked = true;

      // Assign comrade to sector 1
      const res = assignComradeRole(state, 'comrade_jax', 'netrunner', 'sector_01_power');
      expect(res.success).toBe(true);
      expect(res.newState.comrades[0].role).toBe('netrunner');
      expect(res.newState.comrades[0].assignedSector).toBe('sector_01_power');
    });

    it('allows healing injured comrades with med-stims', () => {
      const state = createInitialCyberpunkGameState();
      state.comrades[0].status = 'injured';
      state.player.medStims = 2;

      const res = healComrade(state, 'comrade_jax');
      expect(res.success).toBe(true);
      expect(res.newState.comrades[0].status).toBe('healthy');
      expect(res.newState.player.medStims).toBe(1);
    });
  });

  describe('Weapon Overclocking ("Pack-a-Punch") & Cyber-Perks', () => {
    it('overclocks scrap pistol from Tier 0 to Tier 1 and upgrades elemental shock stats', () => {
      const state = createInitialCyberpunkGameState();
      state.player.credits = 1000;
      state.player.scrap = 50;

      const res = overclockWeapon(state);
      expect(res.success).toBe(true);
      expect(res.newState.player.equippedWeapon.tier).toBe(1);
      expect(res.newState.player.equippedWeapon.name).toBe('Twin-Arc Sparker');
      expect(res.newState.player.equippedWeapon.elementalEffect).toBe('shock');
      expect(res.newState.player.equippedWeapon.damage).toBe(48);
      expect(res.newState.stats.overclocksPerformed).toBe(1);
    });

    it('rejects overclock when weapon has reached Tier 3 maximum', () => {
      const state = createInitialCyberpunkGameState();
      state.player.equippedWeapon = { ...WEAPON_DEFINITIONS.scrap_pistol[3] };
      const check = canOverclockWeapon(state.player, state.player.equippedWeapon);
      expect(check.canOverclock).toBe(false);
      expect(check.reason).toContain('maximum Overclock Tier');
    });

    it('buys cyber-perk Titan Subdermal and expands max shield', () => {
      const state = createInitialCyberpunkGameState();
      state.player.credits = 3000;

      const res = buyPerk(state, 'titan_subdermal');
      expect(res.success).toBe(true);
      expect(res.newState.player.activePerks).toContain('titan_subdermal');
      expect(res.newState.player.maxShield).toBe(200); // 100 + 100
      expect(res.newState.player.credits).toBe(500); // 3000 - 2500
    });
  });

  describe('Combat Mechanics & Calculations', () => {
    it('calculates hitscan damage with shock multiplier against shields', () => {
      const player = createInitialPlayerState();
      const shockWeapon = { ...WEAPON_DEFINITIONS.scrap_pistol[1] }; // 48 dmg, shock
      const enemy = createEnemy('security_droid');
      enemy.shield = 50;
      enemy.hp = 100;

      const result = calculateShotDamage(player, shockWeapon, enemy, false);
      expect(result.hit).toBe(true);
      expect(result.shieldDamage).toBeGreaterThan(0);
      expect(result.totalDamage).toBeGreaterThan(shockWeapon.damage); // Shock deals 1.5x to shields
    });

    it('applies headshot multipliers correctly', () => {
      const player = createInitialPlayerState();
      const weapon = { ...WEAPON_DEFINITIONS.scrap_pistol[0] };
      const enemy = createEnemy('security_droid');

      const bodyHit = calculateShotDamage(player, weapon, enemy, false);
      const headHit = calculateShotDamage(player, weapon, enemy, true);

      expect(headHit.totalDamage).toBeGreaterThan(bodyHit.totalDamage);
    });

    it('absorbs damage in player shield first, then damages HP', () => {
      const player = createInitialPlayerState();
      player.shield = 40;
      player.hp = 100;

      const { updatedPlayer, downed } = applyEnemyDamageToPlayer(player, 60);
      expect(updatedPlayer.shield).toBe(0);
      expect(updatedPlayer.hp).toBe(80); // 100 - (60 - 40)
      expect(downed).toBe(false);
    });

    it('triggers trauma_ghost auto-revive when lethal damage is received', () => {
      const player = createInitialPlayerState();
      player.shield = 0;
      player.hp = 20;
      player.activePerks = ['trauma_ghost'];

      const { updatedPlayer, downed, traumaRevived } = applyEnemyDamageToPlayer(player, 50);
      expect(downed).toBe(false);
      expect(traumaRevived).toBe(true);
      expect(updatedPlayer.hp).toBeGreaterThan(0);
      expect(updatedPlayer.activePerks).not.toContain('trauma_ghost');
    });
  });

  describe('Corporate Breach Raids & Trauma Clinic', () => {
    it('escalates threat based on power signature and triggers raid at 100', () => {
      const state = createInitialCyberpunkGameState();
      state.raidState.threatLevel = 99;

      const { newState, raidTriggered } = updateRaidThreatTick(state, 5);
      expect(raidTriggered).toBe(true);
      expect(newState.raidState.isActive).toBe(true);
      expect(newState.raidState.activeSquad.length).toBeGreaterThan(0);
    });

    it('mitigates breach door damage when enforcer comrades are stationed', () => {
      const stateNoEnforcer = createInitialCyberpunkGameState();
      stateNoEnforcer.raidState.isActive = true;
      stateNoEnforcer.raidState.targetDoorId = 'door_power_substation';
      stateNoEnforcer.raidState.activeSquad = generateWaveEnemies(1, 1);
      stateNoEnforcer.doors.door_power_substation.integrity = 100;

      const stateWithEnforcer = JSON.parse(JSON.stringify(stateNoEnforcer));
      stateWithEnforcer.comrades = [
        {
          id: 'kane',
          name: 'Marcus Kane',
          role: 'enforcer',
          status: 'healthy',
          efficiency: 1.0,
        },
      ];

      const tick1 = processBreachDamageTick(stateNoEnforcer, 4);
      const tick2 = processBreachDamageTick(stateWithEnforcer, 4);

      const dmg1 = 100 - tick1.newState.doors.door_power_substation.integrity;
      const dmg2 = 100 - tick2.newState.doors.door_power_substation.integrity;

      expect(dmg2).toBeLessThan(dmg1);
    });

    it('awards credits, scrap, and keycards when repelling a corporate raid', () => {
      const state = createInitialCyberpunkGameState();
      state.raidState.isActive = true;
      state.player.credits = 100;
      state.player.scrap = 10;

      const { newState, report } = repelRaid(state);
      expect(report.repelled).toBe(true);
      expect(newState.player.credits).toBeGreaterThan(100);
      expect(newState.player.scrap).toBeGreaterThan(10);
      expect(newState.player.decryptKeys).toBe(1);
      expect(newState.stats.raidsRepelled).toBe(1);
    });

    it('revives downed player at safehouse clinic with med-stim', () => {
      const state = createInitialCyberpunkGameState();
      state.player.hp = 0;
      state.player.shield = 0;
      state.player.isDowned = true;
      state.player.medStims = 1;

      const { newState, usedMedStim } = revivePlayerAtClinic(state);
      expect(usedMedStim).toBe(true);
      expect(newState.player.isDowned).toBe(false);
      expect(newState.player.hp).toBe(100);
      expect(newState.player.medStims).toBe(0);
      expect(newState.stats.revivals).toBe(1);
    });
  });
});
