import faker from '@faker-js/faker'
import { interpret } from 'xstate'
import { waitFor } from 'xstate/lib/waitFor'
import { AuthClient } from '../src/client'
import { INVALID_EMAIL_ERROR } from '../src/errors'
import { createResetPasswordMachine } from '../src/machines'
import { Typegen0 } from '../src/machines/reset-password.typegen'
import { BASE_URL } from './helpers/config'
import {
  resetPasswordInternalErrorHandler,
  resetPasswordNetworkErrorHandler,
  resetPasswordUserNotFoundHandler
} from './helpers/handlers'
import server from './helpers/server'
import CustomClientStorage from './helpers/storage'
import { GeneralResetPasswordState } from './helpers/types'

type ResetPasswordState = GeneralResetPasswordState<Typegen0>

const customStorage = new CustomClientStorage(new Map())

const resetPasswordMachine = createResetPasswordMachine(
  new AuthClient({
    backendUrl: BASE_URL,
    clientUrl: 'http://localhost:3000',
    start: false
  })
)

const resetPasswordService = interpret(resetPasswordMachine)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  resetPasswordService.start()
})

afterEach(() => {
  resetPasswordService.stop()
  customStorage.clear()
  server.resetHandlers()
})

test(`should fail if there is a network error`, async () => {
  server.use(resetPasswordNetworkErrorHandler)

  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state: ResetPasswordState = await waitFor(
    resetPasswordService,
    (state: ResetPasswordState) => state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "OK",
      "message": "Network Error",
      "status": 200,
    }
  `)
})

test(`should fail if server returns an error`, async () => {
  server.use(resetPasswordInternalErrorHandler)

  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state: ResetPasswordState = await waitFor(
    resetPasswordService,
    (state: ResetPasswordState) => state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "internal-error",
      "message": "Internal error",
      "status": 500,
    }
  `)
})

test(`should fail if email is invalid`, async () => {
  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.userName()
  })

  const state: ResetPasswordState = await waitFor(
    resetPasswordService,
    (state: ResetPasswordState) => state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchObject(INVALID_EMAIL_ERROR)
})

test(`should fail if user is not found`, async () => {
  server.use(resetPasswordUserNotFoundHandler)

  resetPasswordService.send({
    type: 'REQUEST',
    email: faker.internet.email()
  })

  const state: ResetPasswordState = await waitFor(
    resetPasswordService,
    (state: ResetPasswordState) => state.matches({ idle: 'error' })
  )

  expect(state.context.error).toMatchInlineSnapshot(`
    {
      "error": "user-not-found",
      "message": "No user found",
      "status": 400,
    }
  `)
})

test(`should succeed if email is valid`, async () => {
  resetPasswordService.send({ type: 'REQUEST', email: faker.internet.email() })

  const state: ResetPasswordState = await waitFor(
    resetPasswordService,
    (state: ResetPasswordState) => state.matches({ idle: 'success' })
  )

  expect(state.context.error).toBeNull()
})
