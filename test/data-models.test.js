import assert from "node:assert/strict";
import test from "node:test";

class Field {
  constructor(options = {}) { this.options = options; }
}
class SchemaField extends Field {
  constructor(schema, options = {}) { super(options); this.schema = schema; }
}
class ArrayField extends Field {
  constructor(element, options = {}) { super(options); this.element = element; }
}
class TypeDataModel {
  static migrateData(source) { return source; }
  static validateJoint() {}
}

globalThis.foundry = {
  data: { fields: { ArrayField, BooleanField: Field, NumberField: Field, SchemaField, StringField: Field } },
  abstract: { TypeDataModel }
};

const { AmmoDataModel, EquipmentDataModel, VehicleDataModel, WeaponDataModel } = await import("../module/data-models.js");

test("legacy items receive valid critical-slot assignment defaults", () => {
  const weapon = WeaponDataModel.migrateData({});
  assert.deepEqual({ start: weapon.slotStart, slots: weapon.slots, damaged: weapon.damagedSlots }, { start: 1, slots: 1, damaged: [] });

  const equipment = EquipmentDataModel.migrateData({ slots: 0 });
  assert.equal(equipment.slots, 1);
  assert.equal(equipment.criticalEffect, "general");

  const ammo = AmmoDataModel.migrateData({ slotStart: 4, slots: 2, damagedSlots: [4] });
  assert.deepEqual({ start: ammo.slotStart, slots: ammo.slots, damaged: ammo.damagedSlots }, { start: 4, slots: 2, damaged: [4] });
});

test("vehicle records expose crew, movement, armor, and status schemas", () => {
  const schema = VehicleDataModel.defineSchema();
  for (const field of ["vehicle", "crew", "movement", "armor", "structure", "status"]) assert.ok(schema[field]);
});

test("critical damaged-slot fields are arrays in every item schema", () => {
  for (const model of [WeaponDataModel, EquipmentDataModel, AmmoDataModel]) {
    assert.ok(model.defineSchema().damagedSlots instanceof ArrayField);
  }
});
