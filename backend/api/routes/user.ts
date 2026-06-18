import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';
import { eq, count, desc, or, ilike } from 'drizzle-orm';
import { db, users } from '../../db';
import { checkAdmin } from '../middlewares/auth';
import { idParamSchema } from '../validations/shared';
import { updateUserSchema } from '../validations/user';

export const userRoute = new Hono()
    .use(checkAdmin)
    .get(
        '/',
        zValidator(
            'query',
            z.object({
                page: z.coerce.number().min(1).default(1),
                pageSize: z.coerce.number().min(1).max(100).default(10),
                search: z.string().max(100).optional(),
            })
        ),
        async (c) => {
            const { page, pageSize, search } = c.req.valid('query');
            const skip = (page - 1) * pageSize;

            const whereCondition = search
                ? or(
                      ilike(users.username, `%${search}%`),
                      ilike(users.email, `%${search}%`),
                      ilike(users.name, `%${search}%`)
                  )
                : undefined;

            const [userList, [{ value: total }]] = await Promise.all([
                db
                    .select({
                        id: users.id,
                        username: users.username,
                        email: users.email,
                        role: users.role,
                        banned: users.banned,
                        createdAt: users.createdAt,
                    })
                    .from(users)
                    .where(whereCondition)
                    .offset(skip)
                    .limit(pageSize)
                    .orderBy(desc(users.createdAt)),
                db.select({ value: count() }).from(users).where(whereCondition),
            ]);

            return c.json({
                users: userList,
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            });
        }
    )
    .put(
        '/:id',
        zValidator('param', idParamSchema),
        zValidator('json', updateUserSchema),
        async (c) => {
            const { id } = c.req.valid('param');
            const { username, email } = c.req.valid('json');

            const data = {
                ...(username && { username }),
                ...(email && { email }),
            };

            const [user] = await db
                .update(users)
                .set(data)
                .where(eq(users.id, id))
                .returning({
                    id: users.id,
                    username: users.username,
                    email: users.email,
                    role: users.role,
                    banned: users.banned,
                    createdAt: users.createdAt,
                });

            return c.json(user);
        }
    );
