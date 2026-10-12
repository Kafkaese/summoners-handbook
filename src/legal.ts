// Licensing details shown in the footer and on the license page.

export const APP_NAME = "Summoner's Handbook";

/**
 * Paizo's Community Use Policy requires "up-to-date contact information in a
 * visible location". Point this at the repo's Issues page once it is public.
 */
export const CONTACT: { label: string; href: string } | null = {
  label: 'Kafkaese on GitHub',
  href: 'https://github.com/Kafkaese',
};

/** Required notice, verbatim from paizo.com/licenses/communityuse (updated 2024-08-22). */
export const COMMUNITY_USE_NOTICE =
  `${APP_NAME} uses trademarks and/or copyrights owned by Paizo Inc., used under Paizo's Community Use Policy ` +
  `(paizo.com/licenses/communityuse). We are expressly prohibited from charging you to use or access this content. ` +
  `${APP_NAME} is not published, endorsed, or specifically approved by Paizo. For more information about Paizo Inc. ` +
  `and Paizo products, visit paizo.com.`;

/** Verbatim from paizo.com/paizo/copyright. */
export const PAIZO_TRADEMARK_NOTICE =
  'Paizo Inc., Paizo, the Paizo golem logo, Pathfinder, the Pathfinder logo, Pathfinder Society, Starfinder, the ' +
  'Starfinder logo, GameMastery, and Planet Stories are registered trademarks of Paizo Inc. The Pathfinder Roleplaying ' +
  'Game, Pathfinder Campaign Setting, Pathfinder Adventure Path, Pathfinder Adventure Card Game, Pathfinder Player ' +
  'Companion, Pathfinder Modules, Pathfinder Tales, Pathfinder Battles, Pathfinder Legends, Pathfinder Online, ' +
  "Starfinder Adventure Path, PaizoCon, RPG Superstar, The Golem's Got It, Titanic Games, the Titanic logo, and the " +
  'Planet Stories planet logo are trademarks of Paizo Inc. Dungeons & Dragons, Dragon, Dungeon, and Polyhedron are ' +
  'registered trademarks of Wizards of the Coast, Inc., a subsidiary of Hasbro, Inc., and have been used by Paizo Inc. ' +
  'under license. Most product names are trademarks owned or used under license by the companies that publish those ' +
  'products; use of such names without mention of trademark status should not be construed as a challenge to such status.';
