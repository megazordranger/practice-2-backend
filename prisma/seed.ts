import { PrismaClient, Prisma } from '@prisma/client'
import { faker } from '@faker-js/faker';

export function createRandomUser(todos: any): Prisma.UserCreateInput {
  return {
    name: faker.internet.userName(),
    email: faker.internet.email(),
    todos: {
      createMany: {
        data: todos,
      }
    },
  }
}

export function createRandomTodo(): Prisma.TodoCreateWithoutUserInput {
  return {
    content: faker.lorem.paragraph(),
    completed: false,
    dueDate: faker.date.future(),
  }
}

const prisma = new PrismaClient()

async function main() {
  console.log(`Start seeding ...`)
  for (let i = 0; i < 20; i++) {
    const todoInputs: Prisma.TodoCreateWithoutUserInput[] = [];

    Array.from({ length: 10000 }).forEach(() => {
      todoInputs.push(createRandomTodo());
    });

    const user = createRandomUser(todoInputs);
    const userCreated = await prisma.user.create({
      data: user,
    });
    console.log(`Created user: ${userCreated.name} with 10000 todos`)
  }

  console.log(`Seeding finished.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
