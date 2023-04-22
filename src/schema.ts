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
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

const { Client } = require('@elastic/elasticsearch')

const client = new Client({
  node: 'http://elasticsearch:9200',
})

const indexName = 'todo-comments'
// const indexName = 'todos'
const indexNameComment = 'comments'

const setMap = async () => {
  await client.indices.putMapping({
    index: indexName,
    mappings: {
      properties: {
        todo: {
          type: 'text',
        },
        comments: {
          type: 'nested',
        },
      },
    },
  })
}

// setMap();

dayjs.extend(utc)

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
      },
    })

    t.nonNull.list.nonNull.field('todo', {
      type: 'Todo',
      args: {
        id: nonNull(intArg()),
      },
      resolve: (_parent, { id }, context: Context) => {
        return context.prisma.todo.findMany({
          where: {
            id,
          },
        })
      },
    })

    t.nonNull.list.nonNull.field('todoComments', {
      type: 'Comment',
      args: {
        todo: nonNull(intArg()),
      },
      resolve: (_parent, { todo }, context: Context) => {
        return context.prisma.comment.findMany({
          where: { todoId: todo },
        })
      },
    })

    t.nonNull.list.nonNull.field('todoSearch', {
      type: 'Search',
      args: {
        key: nonNull(stringArg()),
      },
      resolve: async (_parent, { key }, context: Context) => {
        const result = await client.msearch({
          searches: [
            { index: indexName },
            {
              query: {
                bool: {
                  should: [
                    {
                      match: {
                        todo: key,
                      },
                    },
                    {
                      nested: {
                        path: 'comments',
                        query: {
                          bool: {
                            should: [
                              {
                                match: {
                                  'comments.content': key,
                                },
                              },
                            ],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },

            // { query: { match: { content: key } } },
            // { index: indexNameComment },
            // { query: { match: { content: key } } },

            // { index: indexName },
            // {
            //   query: {
            //     nested: {
            //       path: 'comments',
            //       query: {
            //         bool: {
            //           must: [
            //             {
            //               match: { 'comments.content': key },
            //             },
            //           ],
            //         },
            //       },
            //       ignore_unmapped: true,
            //     },
            //   },
            // },
          ],
        })

        console.log('key', key)
        console.log('result', result)

        const values: any = []

        result.responses.forEach((search: any) => {
          if (search.error) {
            console.dir(search, { depth: null })
            return
          }

          console.log('hits', search.hits.hits)

          const hits = search.hits.hits || []

          console.log('hits', hits)

          hits.forEach((item: any) => {
            const value = {
              // id: item._id,
              id: item._source.todoId,
              todoId: item._source.todoId,
              content: item._source.todo,
              // type: item._source.type,
              comments: item._source.comments,
            }

            console.log(item._source.comments)

            values.push(value)
          })
        })

        return values
      },
    })

    t.nonNull.field('allTodosCount', {
      type: 'TodoCount',
      resolve: async (_parent, {}, context: Context) => {
        const count = await context.prisma.todo.count()

        return { count }
      },
    })

    t.nonNull.field('allTodosCountByDueDate', {
      type: 'TodoCount',
      args: {
        dueDate: nonNull(arg({ type: 'DateTime' })),
      },
      resolve: async (_parent, { dueDate }, context: Context) => {
        const beginningOfDay = dayjs(dueDate).utc().startOf('day').format()
        const endOfDay = dayjs(dueDate).utc().endOf('day').format()

        const count = await context.prisma.todo.count({
          where: {
            dueDate: {
              lte: endOfDay,
              gte: beginningOfDay,
            },
          },
        })

        return { count }
      },
    })

    t.nonNull.list.nonNull.field('todosByDueDate', {
      type: 'Todo',
      args: {
        dueDate: nonNull(arg({ type: 'DateTime' })),
        skip: nonNull(intArg()),
        limit: nonNull(intArg()),
      },
      resolve: (_parent, { skip, limit, dueDate }, context: Context) => {
        const beginningOfDay = dayjs(dueDate).utc().startOf('day').format()
        const endOfDay = dayjs(dueDate).utc().endOf('day').format()

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
            },
          },
        })
      },
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
      resolve: async (_, args, context: Context) => {
        const result: any = await context.prisma.todo.create({
          data: {
            content: args.data.content,
            completed: args.data.completed,
            dueDate: args.data.dueDate,
            user: {
              connect: {
                id: args.userId,
              },
            },
          },
        })

        // console.log('result', result)

        // await client.index({
        //   index: indexName,
        //   id: result.id,
        //   refresh: true,
        //   document: {
        //     content: result.content,
        //     todoId: result.id,
        //     type: 'todo',
        //     // comments: [],
        //   },
        // })

        await client.index({
          index: indexName,
          id: result.id,
          refresh: true,
          document: {
            todo: result.content,
            todoId: result.id,
            comments: [],
          },
        })

        return result
      },
    })

    t.field('createComment', {
      type: 'Comment',
      args: {
        data: nonNull(
          arg({
            type: 'CommentCreateInput',
          }),
        ),
        todoId: nonNull(intArg()),
      },
      resolve: async (_, args, context: Context) => {
        const result = await context.prisma.comment.create({
          data: {
            content: args.data.content,
            todo: {
              connect: {
                id: args.todoId,
              },
            },
          },
        })

        console.log('result', result)

        // const comments = await context.prisma.comment.findMany({
        //   where: { todoId: args.todoId },
        //   select: {
        //     content: true,
        //     id: true,
        //   },
        // })

        await client.update({
          index: indexName,
          id: args.todoId,
          script: {
            source: 'ctx._source.comments.addAll(params.comments)',
            params: {
              comments: [result],
            },
          },
        })

        // await client.index({
        //   index: indexNameComment,
        //   id: `${args.todoId}-${result.id}`,
        //   refresh: true,
        //   document: {
        //     todoId: args.todoId,
        //     content: result.content,
        //     type: 'comment',
        //   },
        // })

        return result
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

    t.field('deleteAllTodos', {
      type: 'TodoCount',
      resolve: (_, args, context: Context) => {
        return context.prisma.todo.deleteMany()
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
    t.nonNull.field('dueDate', { type: 'DateTime' })
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
    t.nonNull.list.nonNull.field('comments', {
      type: 'Comment',
      // args: {
      //   skip: nonNull(intArg()),
      //   limit: nonNull(intArg()),
      // },
      resolve: (parent, { limit, skip }, context: Context) => {
        return context.prisma.todo
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .comments()
      },
    })
  },
})

const TodoCount = objectType({
  name: 'TodoCount',
  definition(t) {
    t.nonNull.int('count')
  },
})

const Comment = objectType({
  name: 'Comment',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.field('createdAt', { type: 'DateTime' })
    t.nonNull.field('updatedAt', { type: 'DateTime' })
    t.nonNull.string('content'),
      t.field('todo', {
        type: 'Todo',
        resolve: (parent, _, context: Context) => {
          return context.prisma.comment
            .findUnique({
              where: { id: parent.id || undefined },
            })
            .todo()
        },
      })
  },
})

const Search = objectType({
  name: 'Search',
  definition(t) {
    t.string('id')
    t.int('todoId')
    t.string('content')
    t.string('type')
    t.list.field('comments', {
      type: 'Comment',
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

const CommentCreateInput = inputObjectType({
  name: 'CommentCreateInput',
  definition(t) {
    t.nonNull.string('content')
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
    TodoCount,
    Comment,
    CommentCreateInput,
    Search,
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
