/**
 * `mendeley profile ...` subcommand.
 *
 * Profiles represent Mendeley users.  The "me" profile is the
 * authenticated user; other profiles can be fetched by id (e.g. to
 * look up co-authors).
 */

import { buildSession } from '../credentials.js';

export function register(program) {
  const cmd = program
    .command('profile')
    .description("view user profiles (yours or anyone's by id)")
    .longDescription(
      `Profiles are public-facing records of Mendeley users.  Use
  \`mendeley profile me\` to see your own profile (or alias
  \`mendeley whoami\`), and \`mendeley profile get <id>\` to look up
  any other user by their profile id.`,
    )
    .example('mendeley profile me')
    .example('mendeley whoami')
    .example('mendeley profile get abcdef12-3456-7890');

  cmd
    .command('me')
    .description('show the logged-in user profile')
    .longDescription(
      `Return the full profile of the currently authenticated user.
  This is the canonical "is the token working?" command.`,
    )
    .example('mendeley profile me')
    .action(async (_args, _flags, out) => {
      const session = await buildSession();
      const me = await session.profiles.me;
      out.write(me);
    });

  cmd
    .command('get <id>')
    .description('get a profile by id')
    .longDescription(
      `Fetch a public profile by UUID.  Useful for resolving
  co-authors, group members, etc.`,
    )
    .example('mendeley profile get abcdef12-3456-7890')
    .action(async ([id], _flags, out) => {
      const session = await buildSession();
      const profile = await session.profiles.get(id);
      out.write(profile);
    });
}
