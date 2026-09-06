# Tri-Core Broadblade

Foundry VTT v14 / PF2e module for the Mistwood Tri-Core Broadblade.

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
