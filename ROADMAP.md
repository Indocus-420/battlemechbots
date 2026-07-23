# BattleMech Foundry System Roadmap

## Phase 0 - Bootstrap

- Load the system without errors.
- Create and launch a world using the system.
- Create a BattleMech actor.
- Open its sheet and save/reload data reliably.

Status: complete.

## Phase 1 - Record Sheets

- Original armor diagram without reproducing copyrighted artwork.
- Internal structure and critical slots.
- Heat scale, pilot data, movement, weapons, and ammunition.

Status: functional data sheet and assignable critical-slot tables complete; graphical armor layout remains.

Content milestone: 0.9.0 presents the 20 original ready-to-play BattleMechs in four class-specific compendiums and gives every unit distinct original token art and activation audio.

## Phase 2 - Combat

Implement the complete tabletop turn sequence:

1. Initiative
2. Movement
3. Weapon Attack
4. Physical Attack
5. Heat
6. End Phase

Combat rules include GATOR calculations, hex and terrain movement, elevation, Walls and line of sight, hit locations, armor and internal damage, damage transfer, and critical hits.

### Phase 2 subphases

- 2.1 Core movement modes and modifiers - complete.
- 2.2 Hex paths, terrain Regions, elevation, and Walls - complete.
- 2.3 Weapon attacks and GATOR - complete for direct-fire weapons.
- 2.4 Heat, hit locations, damage transfer, critical slots, and core component effects - complete and live-verified in 0.5.2.
- 2.5 Initiative and complete turn sequencing - complete and live-verified in 0.6.1, including active-versus-viewed encounter handling, loser-first alternation, phase gating, and next-round initiative rerolls.
- 2.6 Physical attacks - first increment complete in 0.7.0: adjacent punch and kick declarations, attack arcs, elevation and prone restrictions, attacker/target/terrain modifiers, actuator damage, limb weapon-fire restrictions, physical hit-location tables, damage transfer, and critical resolution. Automated Piloting Skill Rolls caused by kicks remain in 2.7.
- 2.7 Missile clusters, ammunition consumption, kick Piloting Skill Rolls, End Phase, and remaining combat edge cases - missiles, ammunition, kick PSRs, falls, facing changes, and pilot injury checks implemented in 0.8.0. Version 0.9.0 clears transient movement/action state at End Phase and applies the damaged-life-support underwater pilot hit. Unconscious-pilot recovery, torso/arm reset, and voluntary shutdown/restart remain pending record-sheet state and UI support.

## Phase 3 - Visuals

- Small Laser: red beam.
- Medium Laser: green beam.
- Large Laser: blue beam.
- PPC: blue-white electrical arc.
- Autocannon: tracer and impact sparks.
- SRM/LRM: missile trails, explosions, and cluster impacts.
- Machine Guns: rapid tracers.
- Flamers: fire stream.
- Prefer built-in canvas rendering, with optional animation-module integration when available.

Status: built-in Foundry VTT 14 projectile, impact, and procedural weapon-audio foundation implemented in 0.5.1. Version 0.9.0 adds unique packaged activation portraits and sounds for all 20 original BattleMechs. Version 0.10.0 adds vehicle portraits/audio, item icons, and optional JB2A/Sequencer weapon effects with automatic built-in fallback; weapon-specific refinement and network-synchronized built-in audio remain.

## Interface and optional-module milestone

Version 0.10.0 adds a native BattleTech token action HUD, D6-only quick rolls, Dice So Nice compatibility through Foundry's normal roll pipeline, and Tokenizer integration. These are additive and do not make external modules mandatory.

## Phase 4 - MechLab

- Engine and gyro selection.
- Armor allocation.
- Heat sinks and jump jets.
- Weapons and ammunition.
- Critical-slot allocation.
- Automatic construction-rule validation.

## Phase 5 - Campaign

- Mercenary company management.
- Repairs and salvage.
- Pilot experience.
- Contracts and finances.

Status: first economy increment complete in 0.12.0. The live storefront includes
70 supported listings, GM-controlled M-Notes adjustments, exact-price purchase
deductions, insufficient-funds protection, unit/equipment delivery, and a
250-entry transaction ledger. Shared company accounts, mission payouts, repairs,
salvage, contracts, and pilot progression remain planned.

## Living project documentation

The repository and release ZIP include
`docs/BattleMech_Foundry_VTT_Project_Master.txt`, which combines the Game Design
Document, Technical Design Document, developer roadmap and issue hierarchy,
rules-to-implementation reference, backlog, decisions, change log, and developer
notes. Update it with every material design or implementation change.
