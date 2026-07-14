const {
  BooleanField,
  NumberField,
  SchemaField,
  StringField
} = foundry.data.fields;

function integer(initial = 0, options = {}) {
  return new NumberField({
    required: true,
    nullable: false,
    integer: true,
    initial,
    ...options
  });
}

function text(initial = "", options = {}) {
  return new StringField({
    required: true,
    nullable: false,
    blank: true,
    initial,
    ...options
  });
}

function flag(initial = false) {
  return new BooleanField({
    required: true,
    nullable: false,
    initial
  });
}

function armorLocation(front, rear = null) {
  const schema = {
    front: integer(front, { min: 0 }),
    maxFront: integer(front, { min: 0 })
  };
  if (rear !== null) {
    schema.rear = integer(rear, { min: 0 });
    schema.maxRear = integer(rear, { min: 0 });
  }
  return new SchemaField(schema);
}

function structureLocation(value) {
  return new SchemaField({
    value: integer(value, { min: 0 }),
    max: integer(value, { min: 0 })
  });
}

function assertNotAboveMaximum(value, maximum, label) {
  if (value > maximum) {
    throw new Error(`${label} cannot exceed its maximum (${value} > ${maximum}).`);
  }
}

function clampLegacyCurrentValues(source) {
  for (const armor of Object.values(source.armor ?? {})) {
    if (Number.isFinite(armor.front) && Number.isFinite(armor.maxFront)) {
      armor.front = Math.min(armor.front, armor.maxFront);
    }
    if (Number.isFinite(armor.rear) && Number.isFinite(armor.maxRear)) {
      armor.rear = Math.min(armor.rear, armor.maxRear);
    }
  }

  for (const structure of Object.values(source.structure ?? {})) {
    if (Number.isFinite(structure.value) && Number.isFinite(structure.max)) {
      structure.value = Math.min(structure.value, structure.max);
    }
  }
}

export class MechDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      schemaVersion: integer(3, { min: 1 }),
      pilot: new SchemaField({
        name: text(),
        gunnery: integer(4, { min: 0 }),
        piloting: integer(5, { min: 0 }),
        hits: integer(0, { min: 0, max: 6 })
      }),
      mech: new SchemaField({
        chassis: text("Training Chassis"),
        variant: text("TST-0"),
        tonnage: integer(50, { min: 20, max: 100 }),
        bv: integer(0, { min: 0 }),
        role: text("Test Unit")
      }),
      movement: new SchemaField({
        walk: integer(5, { min: 0 }),
        run: integer(8, { min: 0 }),
        jump: integer(0, { min: 0 }),
        mode: new StringField({
          required: true,
          nullable: false,
          blank: false,
          initial: "stand",
          choices: ["stand", "walk", "run", "jump"]
        }),
        hexesMoved: integer(0, { min: 0 }),
        mpSpent: integer(0, { min: 0 }),
        attackerModifier: integer(0),
        targetModifier: integer(0),
        heatGenerated: integer(0, { min: 0 }),
        terrain: new SchemaField({
          roughHexes: integer(0, { min: 0 }),
          lightWoodsHexes: integer(0, { min: 0 }),
          heavyWoodsHexes: integer(0, { min: 0 }),
          rubbleHexes: integer(0, { min: 0 }),
          waterDepth1Hexes: integer(0, { min: 0 }),
          waterDepth2Hexes: integer(0, { min: 0 }),
          waterDepth3PlusHexes: integer(0, { min: 0 }),
          levelChanges: integer(0, { min: 0 }),
          facingChanges: integer(0, { min: 0 }),
          terrainCost: integer(0, { min: 0 }),
          requiredMp: integer(0, { min: 0 }),
          pilotingChecks: integer(0, { min: 0 })
        })
      }),
      heat: new SchemaField({
        current: integer(0, { min: 0 }),
        sinks: integer(10, { min: 0 }),
        overflow: integer(0, { min: 0 }),
        shutdown: flag(false)
      }),
      armor: new SchemaField({
        head: armorLocation(9),
        centerTorso: armorLocation(20, 6),
        leftTorso: armorLocation(16, 5),
        rightTorso: armorLocation(16, 5),
        leftArm: armorLocation(12),
        rightArm: armorLocation(12),
        leftLeg: armorLocation(16),
        rightLeg: armorLocation(16)
      }),
      structure: new SchemaField({
        head: structureLocation(3),
        centerTorso: structureLocation(16),
        leftTorso: structureLocation(12),
        rightTorso: structureLocation(12),
        leftArm: structureLocation(8),
        rightArm: structureLocation(8),
        leftLeg: structureLocation(12),
        rightLeg: structureLocation(12)
      }),
      status: new SchemaField({
        prone: flag(false),
        destroyed: flag(false)
      })
    };
  }

  static migrateData(source) {
    if ((source.schemaVersion ?? 0) < 1) {
      clampLegacyCurrentValues(source);
      source.schemaVersion = 1;
    }

    if ((source.schemaVersion ?? 0) < 2) {
      source.movement ??= {};
      source.movement.mpSpent ??= source.movement.hexesMoved ?? 0;
      source.movement.heatGenerated ??= 0;
      source.schemaVersion = 2;
    }

    if ((source.schemaVersion ?? 0) < 3) {
      source.movement ??= {};
      source.movement.terrain ??= {};
      for (const field of [
        "roughHexes",
        "lightWoodsHexes",
        "heavyWoodsHexes",
        "rubbleHexes",
        "waterDepth1Hexes",
        "waterDepth2Hexes",
        "waterDepth3PlusHexes",
        "levelChanges",
        "facingChanges",
        "terrainCost",
        "requiredMp",
        "pilotingChecks"
      ]) source.movement.terrain[field] ??= 0;
      source.schemaVersion = 3;
    }

    return super.migrateData(source);
  }

  static validateJoint(data) {
    super.validateJoint(data);

    for (const [location, armor] of Object.entries(data.armor ?? {})) {
      assertNotAboveMaximum(armor.front, armor.maxFront, `${location} front armor`);
      if ("rear" in armor) {
        assertNotAboveMaximum(armor.rear, armor.maxRear, `${location} rear armor`);
      }
    }

    for (const [location, structure] of Object.entries(data.structure ?? {})) {
      assertNotAboveMaximum(structure.value, structure.max, `${location} internal structure`);
    }
  }
}

export class WeaponDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      weaponType: new StringField({
        required: true,
        nullable: false,
        blank: false,
        initial: "laser",
        choices: ["laser", "missile", "autocannon", "ppc"]
      }),
      location: text("rightArm"),
      damage: integer(5, { min: 0 }),
      heat: integer(3, { min: 0 }),
      ammoPerShot: integer(0, { min: 0 }),
      shots: integer(0, { min: 0 }),
      range: new SchemaField({
        minimum: integer(0, { min: 0 }),
        short: integer(3, { min: 0 }),
        medium: integer(6, { min: 0 }),
        long: integer(9, { min: 0 })
      }),
      notes: text()
    };
  }

  static validateJoint(data) {
    super.validateJoint(data);

    const { minimum, short, medium, long } = data.range;
    if (short > medium || medium > long) {
      throw new Error("Weapon ranges must be ordered from short to medium to long.");
    }
    if (minimum > long) {
      throw new Error("Minimum range cannot exceed long range.");
    }
  }
}

export class EquipmentDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      location: text("centerTorso"),
      slots: integer(1, { min: 0 }),
      notes: text()
    };
  }
}

export class AmmoDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ammoType: text("AC/5"),
      location: text("leftTorso"),
      shots: integer(20, { min: 0 }),
      maxShots: integer(20, { min: 0 }),
      notes: text()
    };
  }

  static validateJoint(data) {
    super.validateJoint(data);
    assertNotAboveMaximum(data.shots, data.maxShots, "Ammunition shots");
  }
}
