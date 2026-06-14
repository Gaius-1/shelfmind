import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { organization } from 'better-auth/plugins/organization'
import { db } from '#/db/index.ts'
import * as schema from '#/db/schema.ts'
import { sql } from 'drizzle-orm'
import { getBinding } from './cloudflare.ts'

import { createAuthMiddleware } from 'better-auth/api'

let _auth: any = null

function getAuthInstance() {
  if (_auth) return _auth

  _auth = betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    secret: getBinding('BETTER_AUTH_SECRET'),
    baseURL: getBinding('BETTER_AUTH_URL'),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders: {
      google: {
        clientId: getBinding('GOOGLE_CLIENT_ID'),
        clientSecret: getBinding('GOOGLE_CLIENT_SECRET'),
      },
      github: {
        clientId: getBinding('GITHUB_CLIENT_ID'),
        clientSecret: getBinding('GITHUB_CLIENT_SECRET'),
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

  return _auth
}

// Export a proxy so auth calls can be executed seamlessly
export const auth = new Proxy({} as any, {
  get(_target, prop, receiver) {
    if (prop === 'then' || prop === '$$typeof' || prop === '__esModule' || prop === 'toJSON' || typeof prop === 'symbol') {
      return undefined
    }
    const instance = getAuthInstance()
    const value = Reflect.get(instance, prop, receiver)
    return typeof value === 'function' ? value.bind(instance) : value
  },
  set(_target, prop, value, receiver) {
    if (prop === 'then' || prop === '$$typeof' || prop === '__esModule' || prop === 'toJSON' || typeof prop === 'symbol') {
      return true
    }
    const instance = getAuthInstance()
    return Reflect.set(instance, prop, value, receiver)
  }
})


