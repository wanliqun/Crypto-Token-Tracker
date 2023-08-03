import {expect, test} from '@oclif/test'

describe('tron:track', () => {
  test
  .stdout()
  .command(['tron:track'])
  .it('runs hello', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['tron:track', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
