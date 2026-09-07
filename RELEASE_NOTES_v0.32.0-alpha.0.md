# BattleMech Foundry System v0.32.0-alpha.0

## Draft release update

This build prepares the system for a controlled test game with a clearer activation workflow, visible firing arcs, expanded unit validation, and the first local-data ingestion foundation.

### Player-facing changes

- Move (`2`), Sprint (`3`), Jump (`4`), and Brace (`-`) appear in the token action HUD.
- Sprint and Brace consume the unit's Fire Action.
- Brace grants Guarded and Entrenched; Guarded halves front and side damage while rear attacks bypass it.
- The active combat unit displays a transparent yellow-front, blue-side, red-rear firing-arc overlay that rotates with token facing.
- Team Resolve gains 15 points per round, caps at 100, and grants Inspired at 50 percent.
- Precision Strike (`8`) and Vigilance (`9`) each cost 30 Resolve.
- The HUD includes Multi-Target, Breaching Shot, Evasive Move, Angel of Death, Sensor Lock, Master Tactician, and Bulwark reference controls.

### Content and validation

- Five packaged BattleMechs in every weight class now pass MechLab with Deployment Ready status and no warnings.
- Packaged vehicle weapons now include matching ammunition where required.
- All six packaged vehicles pass movement, armor, structure, weapon, and ammunition readiness checks.
- Construction mass matching recognizes numbered jump jets and location-suffixed weapons.

### Local HBS data workflow

- A normalized local dataset was produced from user-owned BATTLETECH installation files: 103 mechs, 21 vehicles, 173 weapons, 253 pilots, 66 abilities, and related equipment and faction metadata.
- The raw normalized dataset is intentionally excluded from the public system ZIP and GitHub repository. This avoids redistributing copyrighted game content.
- Six referenced Flashpoint weapon IDs were retained as unresolved because the supplied installation contains no matching component definitions.

### Validation

- Automated suite: 200 tests passed before release packaging.
- Live Foundry visual validation is required after installing this package.
