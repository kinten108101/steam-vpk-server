import GLib from 'gi://GLib';

export type SerializerTypes = 'serializer/addon-manifest' | 'serializer/get-addon-response';
export type DeserializerTypes =  'deserializer/addon' | 'deserializer/archive' | 'deserializer/gpfd-addon' | 'deserializer/gpfd-archive';

export interface Serializer<From = any, To = any> {
  serialize(item: From): To | undefined;
}

export interface Deserializer<From = any, To = any> {
  deserialize(manifest: From, overrides: any): To | undefined;
}
