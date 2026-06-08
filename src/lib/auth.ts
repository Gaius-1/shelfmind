import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { organization } from 'better-auth/plugins/organization'
import { db } from '#/db/index.ts'
import * as schema from '#/db/schema.ts'
import { sql } from 'drizzle-orm'

import { createAuthMiddleware } from 'better-auth/api'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            // Check if user already has any organization membership
            const existingMember = await db.select()
              .from(schema.member)
              .where(sql`${schema.member.userId} = ${user.id}`)
              .limit(1)

            if (existingMember.length > 0) {
              console.log(`User ${user.email} already belongs to an organization. Skipping auto-creation.`)
              return
            }

            const orgId = crypto.randomUUID()
            const memberId = crypto.randomUUID()
            const orgSlug = `${user.id}-org`

            await db.insert(schema.organization).values({
              id: orgId,
              name: `${user.name || user.email.split('@')[0]}'s Organization`,
              slug: orgSlug,
              createdAt: new Date(),
            })

            await db.insert(schema.member).values({
              id: memberId,
              organizationId: orgId,
              userId: user.id,
              role: 'owner',
              createdAt: new Date(),
            })

            console.log(`Auto-created organization for user ${user.email}`)
          } catch (error) {
            console.error('Failed to auto-create organization on user signup:', error)
          }
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path.startsWith('/organization/create')) {
        const session = ctx.context.session
        if (!session) {
          return {
            status: 401,
            body: { message: "Unauthorized" }
          }
        }
        const userId = session.user.id
        const existingOrgs = await db.select()
          .from(schema.member)
          .where(sql`${schema.member.userId} = ${userId}`)
        
        if (existingOrgs.length > 0) {
          return {
            status: 400,
            body: { message: "You are only allowed to own or belong to one organization." }
          }
        }
      }
    })
  },
  plugins: [
    organization(),
    tanstackStartCookies(),
  ],
})


