
import * as borsh from 'borsh';

// Helper function to create struct layout
export function struct(fields: Array<{ key: string; type: string }>) {
  const schema = {
    kind: 'struct',
    fields: fields.map(field => [field.key, field.type])
  };
  
  return {
    encode: (data: any, buffer: Buffer) => {
      return borsh.serialize(schema, data, buffer);
    },
    decode: (buffer: Buffer) => {
      return borsh.deserialize(schema, buffer);
    }
  };
}

// Safe deserialize function
export function safeDeserialize(schema: Map<any, any>, constructor: any, data: Buffer) {
  try {
    return borsh.deserialize(schema, constructor, data);
  } catch (error) {
    console.error('Deserialization error:', error);
    throw new Error('Failed to deserialize data');
  }
}
