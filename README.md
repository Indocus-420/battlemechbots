# BattleMech Foundry System — Phase 0

Target: Foundry Virtual Tabletop 14.364.

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
