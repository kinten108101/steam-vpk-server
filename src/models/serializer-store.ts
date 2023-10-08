import { Deserializer, DeserializerTypes, Serializer, SerializerTypes } from "../services/serializers.js";

export interface SerializerStore {
  get(type: DeserializerTypes): Deserializer;
  get(type: SerializerTypes): Serializer;
}

export class SerializerStore extends Map<string, Serializer | Deserializer> {

}
