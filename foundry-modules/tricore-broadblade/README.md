# Tri-Core Broadblade & Cross Tail Matrix

Foundry VTT v14 / PF2e module for the Mistwood Tri-Core Broadblade.

Version 1.1 adds a seven-form Cross Tail Matrix with armor, spear, barrier,
orbiting axes, guided blades, free threads, and the monthly Heartbreaker
execution. Open a PF2e weapon named exactly `Cross Tail` to use it.

Version 1.2 synchronizes the Matrix with the revised live Mistwood statistics,
including the stronger thread, spear, and axe forms and DC 30 techniques.

## Installation

Paste this manifest URL into Foundry's **Install Module** dialog:

`https://raw.githubusercontent.com/Indocus-420/battlemechbots/main/foundry-modules/tricore-broadblade/module.json`

## Use

1. Enable **Tri-Core Broadblade** in the world's Manage Modules screen.
2. Open a PF2e weapon item named exactly `Tri-Core Broadblade`.
3. Click the three core bubbles to cycle Empty → Ruby → Sapphire → Emerald → Topaz, or choose a named preset.
4. **Roll Damage** rolls the base 3d8 slashing plus the configuration's elemental dice.
5. **Use Technique** rolls the preset technique and posts its DC, area, frequency, and secondary effects to chat.

The selected configuration is stored on the item itself and survives reloads. An item's GM may alternatively enable the panel by setting the `tricore-broadblade.enabled` flag.

## Version 1.3.0

- Uses PF2e native damage rolls, including damage-type breakdowns, colored Dice So Nice dice, totals, and damage application buttons.
- Technique cards include clickable PF2e saving throws, area templates, and organized effect lists.
- Locks the Cross Tail sheet to the same compact 700 × 757 size as the Tri-Core Broadblade after every form change.

## Version 1.4.0

- Free Threads now posts PF2e's complete Grapple action and rolls Athletics against the target's Fortitude DC.
- A Free Threads grab or restraint is the explicit prerequisite for the two-action Heartbreaker.
- Guided Twin Blades supports focused automatic damage with a DC 32 basic Reflex save or two split +4 attack rolls at 4d6 per blade.
- Split-target critical failures post the DC 32 Tangled Recoil check and weapon lockout reminder.
- Cross Tail descriptions are migrated to include clickable PF2e actions, damage, saves, checks, and templates for every listed option.
