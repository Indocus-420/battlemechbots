# BattleMech Foundry System v0.33.0-alpha.0

- Adds a local-only HBS vehicle conversion and duplicate-safe Foundry import workflow.
- Imports and validates 21 HBS combat vehicles with 79 embedded weapons, ammunition bins, and equipment items.
- Places imported vehicles in the Vehicles folder and assigns stable HBS source identifiers for repeatable refreshes.
- Distinguishes the two HBS Target Dummy definitions by tonnage so both remain available without duplicate actor names.
- Assigns packaged tracked, wheeled, hover, VTOL, missile-carrier, and assault-vehicle presentation assets and activation audio.
- Adds original Generic Hover Skirmisher and Generic VTOL Gunship support actors to complete movement-class coverage in the controlled test.
- Adds a repeatable controlled-test report covering initiative, movement, weapon, physical, heat, end phase, armor, ammunition, destruction state, presentation, and duplicate checks.
- Passes the 98% controlled-test readiness gate. Raven source data remains pending and is not included.

The release package does not redistribute proprietary HBS source data. The conversion tool operates only on user-owned local normalization output.
