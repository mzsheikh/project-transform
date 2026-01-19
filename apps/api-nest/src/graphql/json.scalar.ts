import { CustomScalar, Scalar } from "@nestjs/graphql";
import { GraphQLScalarType, Kind, ValueNode } from "graphql";

// Minimal JSON scalar to pass through Prisma JSON fields in GraphQL.
function parseJsonLiteral(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT: {
      const value: Record<string, unknown> = {};
      for (const field of ast.fields) {
        value[field.name.value] = parseJsonLiteral(field.value);
      }
      return value;
    }
    case Kind.LIST:
      return ast.values.map((v) => parseJsonLiteral(v));
    case Kind.NULL:
      return null;
    default:
      return null;
  }
}

@Scalar("JSON", () => Object)
export class JsonScalar implements CustomScalar<unknown, unknown> {
  description = "Arbitrary JSON value";

  serialize(value: unknown): unknown {
    return value;
  }

  parseValue(value: unknown): unknown {
    return value;
  }

  parseLiteral(ast: ValueNode): unknown {
    return parseJsonLiteral(ast);
  }
}

export const JsonScalarType = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize(value: unknown) {
    return value;
  },
  parseValue(value: unknown) {
    return value;
  },
  parseLiteral(ast) {
    return parseJsonLiteral(ast as ValueNode);
  },
});
