# BattleMech Foundry System — Phase 0

Target: Foundry Virtual Tabletop 14.363 and newer (verified through 14.364).

## 0.12.0-alpha.0 M-Notes storefront

- Adds an authoritative M-Notes economy stored per Foundry user.
- Adds GM controls to add or remove M-Notes with a required reason.
- Adds a searchable storefront containing every supported system item, all 20 original BattleMechs, and all 6 original vehicles.
- Delivers purchased equipment to an owned BattleMech or vehicle and newly purchased units to the buyer's Mech Bay.
- Deducts the exact listed price, rejects insufficient funds, and records a 250-entry transaction ledger.
- Routes player purchases through a connected Gamemaster so clients cannot submit their own prices or balances.
- Uses campaign-market pricing informed by Sarna equipment references and the HBS BattleTech economy; these M-Notes prices remain editable in source for campaign balancing.

## 0.11.2-alpha.0 Foundry 14.363 compatibility

- Lowers the minimum supported Foundry VTT release to 14.363.
- Retains verification through Foundry VTT 14.364.
- Includes the complete 0.11.1 feature set and aerospace targeting frames.

## 0.11.1-alpha.0 aerospace targeting arcs

- Adds an original transparent Tokenizer ring for aerospace nose, wing-overlap, left/right wing, and aft weapon arcs.
- Adds deterministic aerospace bearing classification for future aerospace-unit attack validation and HUD display.
- Registers the aerospace frame beside the BattleMech firing-arc and incoming-hit-zone frames without adding a Tokenizer dependency.

## 0.11.0-alpha.0 Pilot command, targeting, maps, and synchronized presentation

- Adds a configurable `P` shortcut for a resizable four-tab Pilot and Lance window: Overview, Lance, Mission, and Mech Bay.
- Remembers the player window's size, position, active tab, and collapsed sections for each Foundry user.
- Presents four BattleMech slots and three vehicle-support slots with armor, internals, heat, ammunition, pilot, and readiness summaries.
- Rebuilds the action HUD around compact horizontal categories with nested Energy, Ballistic, Missile, Equipment, firing-group, physical, movement, systems, pilot, and utility menus.
- Supports right-click item-sheet access plus an unlock mode for reorganizing HUD categories while retaining the established command-console appearance and resize behavior.
- Adds two original transparent Tokenizer frames for BattleMech firing arcs and incoming hit zones.
- Adds seeded native random hex-map generation at 25x25, 50x50, 75x75, 100x100, and 125x125, with selectable terrain Drawings and Regions compatible with bulk-selection and Mass Edit workflows.
- Synchronizes fire, hit, miss, melee, walking, running, and jumping audio for all connected clients; JB2A and Sequencer are preferred when available, with the Foundry 14 VFX fallback retained.
- Adds automated coverage for map sizes and seed repeatability, firing arcs and hit zones, Tokenizer registration, player/lance slot construction, readiness, and the expanded entrypoint.

## 0.10.15-alpha.0 Foundry 14 visual-effects correction

- Removes numeric VFX timeline positions that Foundry 14 passes to animejs as timeline labels.
- Restores packaged weapon and melee effects without the `r.indexOf is not a function` playback failure.
- Retains the verified 0.10.14 ammunition accounting and shared-bin weapon-group preflight.
- Adds a regression test for Foundry 14 weapon and melee VFX timelines.

## 0.10.14-alpha.0 ammunition transaction correction

- Tracks SRM and LRM stock as individual missiles and consumes the launcher rack size per volley.
- Consumes one ammunition unit for each autocannon attack and 200 rounds for each machine-gun attack.
- Updates core missile bins to individual missile counts and machine-gun bins to 1,000 rounds.
- Migrates legacy salvo-count missile bins and 200-round machine-gun bins once when the GM loads the world.
- Preflights every firing group against shared compatible bins before the first weapon fires, preventing partial group attacks caused by insufficient stock.
- Keeps current/maximum ammunition and readiness synchronized in the Action HUD.

## 0.10.13-alpha.0 command-console HUD and GM free movement

- Restores the compact dark command-console HUD appearance with its circular portrait, cyan default accents, dense controls, ammunition gauge, and heat ladder.
- Keeps the 0.10.12 resizing, responsive layout, scrollbars, per-user geometry, ammunition values, GATOR display, and faction selection.
- Limits Great House styling to accent colors so every faction retains the established command-console appearance.
- Allows a Gamemaster to place and move tokens freely without BattleTech movement, status, heat, MP, turn, or GATOR restrictions; Foundry's normal GM pause override remains available.
- Leaves normal ownership and BattleTech movement validation in force for players.

## 0.10.12-alpha.0 responsive faction HUD and GATOR display

- Makes the Action HUD manually resizable, responsive, scrollable, and able to remember each user's own size and position.
- Adds automatic CSS-only HUD themes for independent units and Houses Davion, Kurita, Liao, Marik, and Steiner.
- Adds a faction selector to the BattleMech sheet and migrates existing units safely to Independent.
- Shows compatible ammunition as current/maximum on every ammunition weapon and warns or disables attacks when no compatible stock remains.
- Adds a five-step GATOR display to the HUD and Combat Tracker, with Gamemaster previous, advance, and reset controls.
- Refreshes the open HUD immediately when its BattleMech or embedded equipment changes.

## 0.10.11-alpha.0 authoritative attacker-token routing

- Player weapon and physical-attack requests now identify the exact attacking
  Scene token.
- The active Gamemaster validates that token against the owned BattleMech and
  resolves range, facing, effects, and audio from that exact token.
- This removes ambiguous world-Actor token selection found during the live 4v4
  multiplayer facing test.

## 0.10.10-alpha.0 non-blocking multiplayer dice

- Adds a strict four-second ceiling to direct Dice So Nice playback.
- Prevents a hidden or inactive Gamemaster browser from blocking authoritative player attacks while waiting for a 3D dice animation.
- Preserves Dice So Nice synchronization, weapon colors, and duplicate-animation suppression after the timeout.
- Guarantees that chat output and the response to Player3 or Player4 continue even if Dice So Nice never resolves its animation promise.
- Corrects the live 0.10.9 test where GM authority applied heat and fired-location state but the player request timed out before chat and response delivery.

## 0.10.9-alpha.0 multiplayer teams

- Adds explicit Team A and Team B encounter rosters supporting 1v1 through 4v4, including the requested 2v2, 3v3, and 4v4 formats.
- Adds GM token controls to assign controlled tokens to either team, clear selected assignments, and display the complete roster.
- Automatically adds selected BattleMech and combat-vehicle tokens to the active Combat Tracker before assigning their team.
- Stores team identity on Combatants rather than depending on token ownership or disposition, allowing Player3 and Player4 to share a team cleanly.
- Prevents either team from exceeding four operational units and rejects duplicate or cross-team unit membership.
- Feeds Team A and Team B directly into the existing Initiative, loser-first movement, weapon, and physical attack activation sequence.

## 0.10.8-alpha.0 authoritative player combat

- Enables Foundry's authenticated system socket in `system.json`; the live 0.10.6 audit confirmed that combat-effect messages were not relayed without this required manifest declaration.
- Routes non-Gamemaster weapon and physical attacks to the active Gamemaster for authoritative resolution.
- Validates the server-supplied socket sender, connected user, attacker ownership, embedded weapon ownership, active Scene, and target before accepting an action.
- Resolves enemy damage, critical hits, heat, ammunition, fired locations, kick Piloting checks, chat, dice, sound, and visuals from the Gamemaster client so a player never needs ownership of the enemy Actor.
- Locks each attacker while its authoritative action is resolving, preventing double-clicks or overlapping requests from spending ammunition or applying damage twice.
- Blocks non-Gamemaster attacks cleanly when no Gamemaster is connected instead of partially spending ammunition or heat.
- Adds Player3-role regression coverage for weapon and physical combat authority boundaries.

## 0.10.7-alpha.0 stabilization and live-world repair

- Repairs system-owned BattleMech and vehicle compendiums by replacing their packed Actor copies with clean catalog sources, preventing repeated synchronization from preserving duplicated embedded weapons, ammunition, or equipment. World Actors are never replaced or reset.
- Removes duplicate same-name compendium entries and prunes obsolete entries during synchronization.
- Reports the exact reason each weapon in a firing group did not fire, including range, line-of-sight, ammunition, destruction, targeting, and other attack validation failures.
- Expands invalid Combat Tracker side errors with the current assignment of every eligible unit and direct guidance for correcting token dispositions or explicit BattleTech side flags.
- Audited the deployed Foundry 14.364 world with the active optional-module stack and the newly installed Rideable and routinglib modules.

## 0.10.6-alpha.0 synchronized combat presentation and collateral damage

- Adds four configurable action-hub firing groups: Group 1, Group 2, Group 3, and Alpha. Every weapon can be assigned from its action-hub row, with unassigned and existing weapons defaulting to Alpha.
- Fires every operational weapon in a selected group through the normal attack engine, preserving individual attack rolls, ranges, heat, ammunition use, hit/miss resolution, scatter, collateral damage, effects, and sound.
- Posts a group summary naming the pilot and firing group, then reports each weapon's roll, target number, range bracket, damage, heat, ammunition remaining, plus combined hits, misses, collateral hits, heat, ammunition spent, and applied damage.
- Sends built-in weapon and melee hit/miss visuals to every connected client and broadcasts packaged combat audio through Foundry's socket-aware audio helper.
- Adds distinct synthesized sounds for small, medium, and large lasers, PPCs, missiles, ballistic weapons, melee hits, and melee misses.
- Gives punch and kick attacks visible hit and miss effects.
- Scatters every missed weapon attack into a random adjacent hex using 1D6. An operational BattleMech in that hex receives normal weapon damage; missiles also resolve their cluster roll and damage groups. Empty impact hexes receive the effect without damage.
- Expands weapon chat cards with attack roll, target number, complete weapon statistics, GATOR breakdown, heat, ammunition before/after, scatter result, cluster grouping, damage output, receiving unit, armor/internal damage, destruction, and critical results.
- Verifies every operational sheet weapon appears in the action hub and adds catalog-wide tests for media, ammunition matching/stock, and damage output.

## 0.10.5-alpha.0 weapon dice themes

- Gives Dice So Nice attack rolls weapon-specific custom colors: Small/Medium/Large Lasers use red/green/blue; SRM/MRM/LRM launchers use yellow/orange/brown; PPCs use blue-white; and ballistic weapons use white.
- Classifies known weapons by weapon family and name, with the current range bracket as a fallback for future generic laser or missile items.
- Leaves ordinary skill, initiative, piloting, and other BattleTech rolls under each player's normal Dice So Nice appearance.

## 0.10.4-alpha.0 Dice So Nice palette routing hotfix

- Activates the Dice So Nice sidebar panel when necessary before opening its 3D Dice Settings dialog, so the action-hub palette works even when that sidebar panel has not previously been rendered.

## 0.10.3-alpha.0 Dice So Nice integration

- Detects the active Dice So Nice module and sends system roll objects directly to `game.dice3d.showForRoll`.
- Marks the matching Foundry chat message with Dice So Nice's developer `skip` flag after a successful direct handoff, preventing duplicate animations.
- Uses the built-in animated BattleTech dice only when Dice So Nice is inactive, unavailable, or its direct API fails.
- Routes the action-hub palette to Dice So Nice's 3D configuration when the module is active; the built-in appearance dialog remains the fallback controller.

## 0.10.2-alpha.0 dice customization persistence fix

- Reads Foundry VTT 14 `DialogV2.input` results through its `FormDataExtended.get` interface so visual-dice visibility, colors, and size save correctly and the preview is displayed.

## 0.10.1-alpha.0 movable action hub and visual dice

- Drag the action hub by its header; its position is retained in that browser.
- Every system D6 control now produces a built-in on-screen tumble animation as well as the standard Foundry chat roll.
- Use the palette button in the action hub to enable or disable visual dice and customize their body color, pip color, and size.
- Dice So Nice remains an optional enhancement and continues to receive standard Foundry roll messages when installed.

## 0.10.0-alpha.0 D6, HUD, integrations, and catalog media

- Adds 1D6 and 2D6 Scene controls plus Gunnery and Piloting checks in a native BattleTech token action HUD. All rolls use Foundry `Roll` and `toMessage`, so Dice So Nice animates them automatically when enabled.
- Adds a Tokenizer action to the BattleMech sheet and controlled-token HUD. Tokenizer remains optional and enforces Foundry file-upload permissions.
- Uses supported JB2A and Sequencer APIs for laser, PPC, autocannon, and missile effects when both modules are active; built-in SVG effects remain the automatic fallback.
- Adapts the Token Action HUD interaction model into a dependency-free BattleTech command console with a circular unit portrait, pilot and movement identity, four summarized firing groups, direct weapon and melee controls, ammunition gauge, five-stage heat ladder, D6 checks, sheet access, and token editing. Optional integrations can extend the HUD through `bmfs.actionHudModel` and `bmfs.actionHudRendered` hooks without replacing it.
- Splits the item catalog into Energy, Ballistic, Missile, and Equipment compendiums. The original item collection becomes Energy and is pruned during migration.
- Gives all 44 catalog items distinct original SVG icons.
- Gives all six original vehicles distinct SVG token portraits, synthesized WAV activation sounds, and selection effects.

## 0.9.0-alpha.0 media, roster, and End Phase milestone

- Gives every one of the 20 original BattleMechs a distinct, original SVG token portrait and synthesized WAV activation sound.
- Separates the roster into Light, Medium, Heavy, and Assault world compendiums, with five BattleMechs in each.
- Plays the selected BattleMech's portrait pulse and activation sound when the GM records its phase selection; both cues have client settings.
- Automates the representable End Phase work: clears per-turn movement/action state and applies one pilot hit when damaged life support is fully submerged.
- Retains the original `bmfs-core-mechs` collection as the Light pack so existing worlds migrate without an orphaned 20-unit pack.

This build uses:

- `documentTypes` in `system.json`
- `foundry.abstract.TypeDataModel`
- `CONFIG.Actor.dataModels` and `CONFIG.Item.dataModels`
- `ActorSheetV2` and `ItemSheetV2`
- `HandlebarsApplicationMixin`
- V14 sheet registration through Foundry document collections

There is no `template.json`.

## Install

Extract the `battletech-foundry-system` folder into your Foundry user-data `Data/systems` directory. The final path must be:

`Data/systems/battletech-foundry-system/system.json`

Restart Foundry completely, create a new world, and select **BattleMech Foundry System**.

## Phase 0 test

1. Create a `mech` Actor.
2. Open its sheet.
3. Change chassis, pilot, movement, heat, armor, and structure values.
4. Close and reopen the sheet to verify persistence.
5. Create a `weapon` Item.
6. Drag it onto the mech.
7. Click **Test 2D6 Roll**.
8. Run `game.bmfs.runDiagnostics()` in the F12 console.


## 0.1.5 persistence fix

- The ApplicationV2 sheet itself is now the top-level `form`.
- Removed nested `<form>` elements from Handlebars templates.
- Added explicit V14 form submission handlers for Actor and Item sheets.
- Added a visible **Save Changes** button while retaining submit-on-change behavior.


## 0.1.6-alpha.0
- Fixed Foundry V14 ApplicationV2 template-part rendering by ensuring each sheet template renders exactly one root HTML element.

## Alpha 0.1.7 embedded-item fix

- Displays embedded weapons, equipment, and ammunition in separate sheet sections.
- Adds Edit and Remove controls for every embedded Item.
- Multiple copies of the same weapon are allowed intentionally because each represents a separately installed weapon.

## 0.1.10-alpha.0

Fixed embedded Item Edit and Remove controls by binding V14 DOM listeners after each sheet render. Removal now asks for confirmation.


## 0.1.10-alpha.0
Fixed embedded Item Edit and Remove actions by resolving `data-item-id` directly inside each Foundry V14 action handler.

## 0.1.11-alpha.0

- Restored Foundry V14's native `submitOnChange` form lifecycle.
- Removed custom autosave listeners that duplicated the framework lifecycle.
- Added one-time schema migration and joint validation for armor and structure.
- Added joint validation for ammunition capacity and ordered weapon ranges.
- Updated sheet registration to `DocumentSheetConfig.registerSheet`.
- Corrected UTF-8 display characters and the root sheet-form CSS selector.

## Phase 1 - 0.2.0-alpha.0

- Implements Standing Still, Walking, Running, and Jumping movement modes from the A Game of Armored Combat rulebook.
- Tracks hexes moved separately from MP spent so facing and terrain costs can be added cleanly.
- Validates movement against the selected mode's available MP.
- Derives attacker movement modifiers: 0 / +1 / +2 / +3.
- Derives target movement modifiers from hexes travelled, including the additional +1 for jumping.
- Applies movement heat: 0 standing, 1 walking, 2 running, and at least 3 when jumping.
- Makes movement heat application idempotent when a movement plan is corrected and reapplied.
- Adds prone, shut-down, and destroyed state controls and blocks illegal normal movement.
- Posts a movement summary to chat for testing and turn bookkeeping.
- Terrain costs, standing attempts, and direct token-path enforcement are intentionally reserved for the next movement builds.

### 0.2.1-alpha.0 correction

- Applies movement from the live sheet fields in one atomic update, preventing MP Spent from being overwritten by a second form submission.

### 0.2.2-alpha.0 correction

- Preserves applied movement modifiers and movement heat during Foundry's submit-on-change saves, so switching movement modes correctly replaces the previous movement heat instead of leaving orphaned heat behind.

## Phase 2 - 0.3.0-alpha.0

- Adds a terrain-path summary to the BattleMech sheet for rough, woods, rubble, water depth, level changes, and facing changes.
- Applies the A Game of Armored Combat Movement Costs Table: every entered hex costs 1 MP, with terrain, level, and facing costs added for walking and running.
- Ignores terrain, level, and facing costs while jumping, as required by the jumping rules.
- Prevents running into Depth 1 or deeper water.
- Flags each rubble or water entry that requires a Piloting Skill Roll and reports its rulebook modifier in chat.
- Migrates existing actors to schema version 3 without changing their current movement or heat values.
- This first Phase 2 increment uses an explicit path summary because painted scene backgrounds do not contain machine-readable terrain. Foundry Region integration and direct token-path enforcement remain later Phase 2 work.

### 0.3.1-alpha.0 Region and token-path automation

- Adds GM-only Region toolbar presets for rough, light woods, heavy woods, rubble, and water depths 1, 2, and 3+.
- Stores the selected terrain type on the Region and gives it a matching overlay color.
- Reads every entered token hex against tagged Regions and automatically accumulates terrain and elevation costs.
- Uses the most costly applicable terrain when Regions overlap, with a deterministic priority for equal costs.
- Adds Walking, Running, and Jumping token movement actions and prevents changing mode after movement starts.
- Rejects movement beyond the BattleMech's MP allowance, running through water, ground elevation changes over two levels per hex, and movement by prone, shut-down, or destroyed BattleMechs.
- Updates movement totals, modifiers, heat, and Piloting Skill Roll reminders after each accepted token move.
- Clearing movement from the sheet also clears the active token's Foundry movement history.
- Facing changes remain a manual path entry in this increment; native ruler cost previews and automatic facing calculation are later Phase 2 work.

### 0.3.2-alpha.0 startup correction

- Preserves Foundry V14's built-in movement-action descriptors instead of replacing the complete registry.
- Keeps Walking as the base configurable Region movement action and derives Running from it while Jumping ignores Region cost.
- Prevents the `ModifyMovementCostRegionBehaviorType.defineSchema` localization failure that stopped 0.3.1 during game initialization.

### 0.3.3-alpha.0 measured token-path correction

- Combines Foundry's completed (`passed`) and remaining (`pending`) movement sections instead of reading only the remaining section after a drag completes.
- Prevents zero-space token adjustments from generating movement heat or chat records.
- Uses the Walking, Running, or Jumping mode selected on the BattleMech sheet for direct token movement.
- Leaves Foundry's native token movement-action registry completely unchanged.

## Phase 3 - 0.4.0-alpha.0

- Adds a tested GATOR weapon-attack calculator using Gunnery, attacker movement, target movement, heat, terrain, and range.
- Adds Minimum, Short, Medium, and Long range support to weapon Items.
- Adds an Attack action to every installed weapon; target exactly one BattleMech token and click the crosshairs button to roll.
- Measures range in hexes with Foundry VTT 14's direct grid path.
- Reads intervening and target woods from the same Region terrain tags used by movement.
- Applies +1 per intervening Light Woods hex, +2 per intervening Heavy Woods hex, and the target hex's woods modifier.
- Blocks line of sight when intervening woods exceed +2.
- Applies automatic partial cover for a standing target in Depth 1 water and enforces submerged-versus-surface targeting restrictions.
- Applies prone and shut-down target modifiers from the Attack Modifiers Table.
- Posts the 2D6 result, Target Number, GATOR breakdown, range bracket, and terrain summary to chat.
- Level-1 hill/building partial cover and LOS lines that fall exactly between two hex paths remain manual adjudications in this first combat increment.

### 0.4.1-alpha.0 live-test correction

- Resolves weapon attacks from both linked and Foundry's default unlinked BattleMech tokens.

### 0.4.2-alpha.0 native terrain-boundary and elevation integration

- Uses Foundry's native Wall movement restrictions to stop token movement; no BattleTech-specific Wall type is required.
- Tests weapon attacks against Foundry's native sight-collision backend so sight-blocking Walls prevent an attack.
- Continues using Regions for area terrain such as woods, rough, rubble, and water, including each Region's native elevation range.
- Converts whole-number token movement elevations directly into BattleTech level changes and MP costs.
- Correctly calculates elevation across completed and pending multi-part movement paths.
- Rejects fractional BattleTech elevations and ground movement exceeding two levels in one hex.
- Foundry's native Modify Movement Cost Region behavior should not be added to BattleTech terrain Regions because the system already applies the rulebook's additive MP costs.

## Consolidated roadmap

The major project phases are now Bootstrap, Record Sheets, Combat, Visuals, MechLab, and Campaign. The earlier movement, terrain, heat, and critical milestones are tracked as Combat subphases. See `ROADMAP.md` for the authoritative sequence.

## Phase 2.4 - 0.5.0-alpha.0 Heat and critical foundations

- Adds weapon heat whenever a valid weapon attack is fired, whether it hits or misses.
- Processes a Heat Phase with engine critical heat, heat-sink dissipation, overflow, shutdown avoidance/restart, and ammunition explosion checks.
- Applies the Heat Scale's cumulative Walking MP reductions and weapon-attack modifiers; Running MP is recalculated from the reduced Walking MP and Jumping MP is unaffected.
- Rolls attack direction and hit location for successful direct-fire weapon attacks.
- Applies damage to the correct front or rear armor, then internal structure, transferring excess damage inward when a location is destroyed.
- Destroys an attached arm when its side torso is destroyed and marks a BattleMech destroyed when its head or center torso is destroyed.
- Rolls through-armor and internal-damage critical checks, including head/limb blow-off results, and records unresolved critical hits by location.
- Adds engine, gyro, sensor, life-support, cockpit, and pending-location critical status to the record sheet.
- Adds critical-hit/destroyed state to equipment and damage-per-shot to ammunition bins.
- Resolves failed overheat ammunition checks against the most destructive loaded ammunition type and applies the explosion directly to internal structure.
- The detailed critical-slot editor and automatic per-component critical effects are delivered by 0.5.1-alpha.0 below.

### 0.5.1-alpha.0 critical-slot resolution

- Adds assignable location, starting-slot, and slot-count fields to weapons, equipment, and ammunition.
- Displays all 78 BattleMech critical slots on the record sheet, including empty, ready, hit, and conflicting assignments.
- Resolves head and leg criticals with one d6 and arm and torso criticals with the rulebook's block-plus-slot rolls, rerolling empty and previously hit slots.
- Preserves unhit slots on disabled multi-slot components so later criticals can be absorbed correctly.
- Transfers critical hits inward when a location was already exhausted, while losing excess hits that exhaust a location during the current resolution.
- Automatically applies engine, gyro, sensor, life-support, cockpit, heat-sink, jump-jet, leg-actuator, hip, and arm-actuator effects.
- Applies sensor and arm-actuator modifiers to weapon attacks, blocks firing after two sensor hits, and applies life-support pilot damage during the Heat Phase.
- Explodes loaded ammunition when its critical slot is hit and applies the result directly to internal structure.
- Destroys installed components when their location is destroyed and applies the one-leg/two-leg movement and falling states.

### 0.5.1-alpha.0 core content and effects

- Adds a combat-vehicle Actor type and editable vehicle sheet for tracked, wheeled, hover, and VTOL records.
- On first GM load, creates and synchronizes two locked world compendiums: 44 core Item templates and 6 original generic combat vehicles.
- The Item catalog includes standard energy, ballistic, missile, and support weapons; matching ammunition; and core components/actuators for the critical table.
- Compendium synchronization is idempotent and updates entries by name without duplicating them on later reloads.
- Enables Foundry VTT 14's built-in VFX framework and plays packaged SVG projectiles/impacts for lasers, PPCs, autocannons, and missiles.
- Adds client settings for visual effects and lightweight procedural weapon audio; no third-party media files are bundled.
- Missile cluster resolution and full vehicle combat/motive-damage rules remain future Combat subphases.

### 0.5.2-alpha.0 embedded-item persistence correction

- Preserves the complete embedded Item system source when recording critical-slot damage, ammunition explosions, or location destruction.
- Prevents Foundry VTT 14 from resetting unrelated component fields such as slot count, critical effect, ammunition type, and damage per shot during those updates.
- Adds regression coverage for six-slot engine criticals and ammunition-bin persistence.

### 0.6.0-alpha.0 initiative and turn-sequence controls

- Uses an active Foundry Combat Encounter as the unit roster for a BattleTech turn.
- Groups combatants into Friendly and Hostile sides from token disposition, with optional explicit side flags for custom team names.
- Rolls 2D6 per side, automatically rerolls ties, records the winner on the Combat document, and starts alternating actions with the Initiative loser.
- Adds Token Controls for starting a turn, recording the controlled unit selection, and advancing the phase.
- Enforces the Movement, Weapon Attack, Physical Attack, Heat, and End sequence and prevents advancing while required alternating selections remain.
- Applies the rulebook's unequal-force ratio to determine how many units the larger side must select at once.

### 0.6.1-alpha.0 active-encounter correction

- Resolves BattleTech turns against `game.combats.active`, the Foundry VTT 14 active Combat Encounter.
- Prevents a different encounter currently displayed in the Combat Tracker from receiving initiative or phase operations.

### 0.7.0-alpha.0 physical attacks

- Adds punch and left/right kick controls to the BattleMech record sheet for use during the Physical Attack Phase.
- Uses Piloting Skill as the base target number and applies the tabletop attack-type, attacker movement, target movement/status, terrain, and actuator modifiers without adding heat or sensor modifiers.
- Enforces adjacency, attack arcs, one-level elevation limits, prone restrictions, destroyed limbs/actuators, and the restriction against using a limb whose mounted weapon fired that turn.
- Supports both-arm punches when legal, with one attack and hit-location roll per arm, and previews every target number and damage value before committing the action.
- Resolves punch, kick, and elevation-dependent normal hit-location tables through the existing armor, internal structure, transfer, and critical-hit engine.
- Reports the Piloting Skill Roll required after a kick hits or misses; automatic resolution of those checks is intentionally reserved for the next combat increment.

### 0.7.1-alpha.0 original BattleMech roster

- Adds a locked, automatically synchronized `BMFS Original BattleMechs` world compendium with 20 ready-to-use units.
- Provides five original designs in each weight class: Light, Medium, Heavy, and Assault.
- Each Actor includes a linked prototype token, baseline pilot skills, movement and heat ratings, complete armor and internal structure, weapons, ammunition, jump jets, external heat sinks, standard components, and collision-free critical-slot assignments.
- Light: Sparrowhawk, Needleback, Ridge Runner, Wayfarer, and Bulwark Scout.
- Medium: Emberguard, Borderer, Rampart, Horizon, and Vanguard.
- Heavy: Stormwarden, Hammerfall, Watchtower, Dreadrunner, and Bastion.
- Assault: Citadel, Monolith, Siegebreaker, Colossus, and Fortress.
- The designs are original system test/gameplay units rather than reproductions of published BattleTech record sheets.

### 0.8.0-alpha.0 missile, ammunition, and falling resolution

- Expends one shot from an exact matching ammunition bin when a ballistic or missile attack is declared, before the attack roll; an unloaded weapon cannot fire.
- Uses the complete 2D6 Cluster Hits Table for SRM and LRM launchers.
- Resolves each successful SRM as a separate 2-point hit and groups LRM damage into five-point groups plus any remainder, with an independent hit location and critical processing for every group.
- Automatically resolves the kicked target's Piloting Skill Roll after a successful kick and the attacker's roll after a missed kick.
- Applies gyro, destroyed-leg, shutdown, hip, and leg/foot actuator modifiers, including automatic falls.
- Resolves facing after a fall, token rotation, tonnage-and-level falling damage in five-point groups, prone status, and the pilot injury check.
- When several matching ammunition bins are loaded, the smallest nonempty bin is consumed first; an explicit player bin-selection dialog remains a later interface refinement.
