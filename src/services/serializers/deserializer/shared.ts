import { DefaultEncoder } from "../../files.js";
import { Addon } from "../../../models/addons.js";
import { SerializerStore } from "../../../models/serializer-store.js";
import DiskCapacity from "../../disk-capacity.js";
import { AddonManifest } from "../../schema/addon-manifest.js";
import { Serializer } from "../../serializers.js";

export function make_setup_size_sync(disk_capacity: DiskCapacity) {
  return (item: Addon, interface_: {
    set_size(val: number): void;
  }) => {
    disk_capacity.connect(`cache-changed::${item.id}`, (_obj, size) => {
      interface_.set_size(size);
    });
  };
}

export function make_addon_jsonfy(store: SerializerStore): (item: Addon) => Uint8Array {
  const generator: Serializer<Addon, AddonManifest> = store.get('serializer/addon-manifest');
  return (item: Addon) => {
    const obj = generator.serialize(item);
    const str = JSON.stringify(obj);
    const bytes = DefaultEncoder.encode(str);
    return bytes;
  };
}
