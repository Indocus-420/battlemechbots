# BattleMech Foundry System v0.32.8-alpha.0

- Prevents two connected Gamemaster clients from synchronizing managed compendiums at the same time.
- Restricts automatic startup migrations, compendium refreshes, and map-pack synchronization to Foundry's active Gamemaster.
- Fixes the locked `world.bmfs-core-items` update failure seen during world loading.
- Retains native 2d6 initiative and the rendered-token firing-arc lock.
