import {
  intArg,
  makeSchema,
  nonNull,
  objectType,
  stringArg,
  inputObjectType,
  arg,
  asNexusMethod,
  enumType,
  core,
} from 'nexus'
import { DateTimeResolver } from 'graphql-scalars'
import { Context } from './context'
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const DateTime = asNexusMethod(DateTimeResolver, 'date')

const Query = objectType({
  name: 'Query',
  definition(t) {
    t.nonNull.list.nonNull.field('allUsers', {
      type: 'User',
      args: {
        skip: nonNull(intArg()),
        limit: nonNull(intArg()),
      },
      resolve: (_parent, { skip, limit }, context: Context) => {
        return context.prisma.user.findMany({
          take: limit,
          skip: skip,
          orderBy: {
            id: 'asc',
          },
        })
      },
    })

    t.nonNull.list.nonNull.field('allTodos', {
      type: 'Todo',
      args: {
        skip: nonNull(intArg()),
        limit: nonNull(intArg()),
      },
      resolve: (_parent, { skip, limit }, context: Context) => {
        return context.prisma.todo.findMany({
          take: limit,
          skip: skip,
          orderBy: {
            createdAt: 'desc',
          },
        })
      }
    })

    t.nonNull.list.nonNull.field('todosByDueDate', {
      type: 'Todo',
      args: {
        dueDate: nonNull(arg({ type: "DateTime" })),
        skip: nonNull(intArg()),
        limit: nonNull(intArg()),
      },
      resolve: (_parent, { skip, limit, dueDate }, context: Context) => {
        const beginningOfDay = dayjs(dueDate).utc().startOf('day').format();
        const endOfDay = dayjs(dueDate).utc().endOf('day').format();

        return context.prisma.todo.findMany({
          take: limit,
          skip: skip,
          orderBy: {
            createdAt: 'desc',
          },
          where: {
            dueDate: {
              lte: endOfDay,
              gte: beginningOfDay,
            }
          }
        })
      }
    })
  },
})

const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.field('createTodo', {
      type: 'Todo',
      args: {
        data: nonNull(
          arg({
            type: 'TodoCreateInput',
          }),
        ),
        userId: nonNull(intArg()),
      },
      resolve: (_, args, context: Context) => {
        return context.prisma.todo.create({
          data: {
            content: args.data.content,
            completed: args.data.completed,
            dueDate: args.data.dueDate,
            user: {
              connect: {
                id: args.userId,
              }
            }
          },
        })
      },
    })

    t.field('toggleTodoCompleted', {
      type: 'Todo',
      args: {
        id: nonNull(intArg()),
      },
      resolve: async (_, args, context: Context) => {
        try {
          const todo = await context.prisma.todo.findUnique({
            where: { id: args.id },
            select: {
              completed: true,
            },
          })
          return context.prisma.todo.update({
            where: { id: args.id },
            data: { completed: !todo?.completed },
          })
        } catch (e) {
          throw new Error(
            `Todo with ID ${args.id} does not exist in the database.`,
          )
        }
      },
    })

    t.field('deleteTodo', {
      type: 'Todo',
      args: {
        id: nonNull(intArg()),
      },
      resolve: (_, args, context: Context) => {
        return context.prisma.todo.delete({
          where: { id: args.id },
        })
      },
    })
  },
})

const User = objectType({
  name: 'User',
  definition(t) {
    t.nonNull.int('id')
    t.string('name')
    t.nonNull.string('email'),
    t.nonNull.list.nonNull.field('todos', {
      type: 'Todo',
      args: {
        skip: nonNull(intArg()),
        limit: nonNull(intArg()),
      },
      resolve: (parent, { limit, skip }, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .todos({
            take: limit,
            skip: skip,
            orderBy: {
              updatedAt: 'desc',
            },
          })
      },
    })
  },
})

const Todo = objectType({
  name: 'Todo',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.field('createdAt', { type: 'DateTime' })
    t.nonNull.field('updatedAt', { type: 'DateTime' })
    t.nonNull.string('content')
    t.nonNull.boolean('completed')
    t.field('user', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.todo
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .user()
      },
    })
  },
})

const TodoCreateInput = inputObjectType({
  name: 'TodoCreateInput',
  definition(t) {
    t.nonNull.string('content')
    t.nonNull.date('dueDate')
    t.nonNull.boolean('completed')
  },
})

export const schema = makeSchema({
  types: [
    Query,
    Mutation,
    Todo,
    User,
    TodoCreateInput,
    DateTime,
  ],
  outputs: {
    schema: __dirname + '/../schema.graphql',
    typegen: __dirname + '/generated/nexus.ts',
  },
  contextType: {
    module: require.resolve('./context'),
    export: 'Context',
  },
  sourceTypes: {
    modules: [
      {
        module: '@prisma/client',
        alias: 'prisma',
      },
    ],
  },
})
