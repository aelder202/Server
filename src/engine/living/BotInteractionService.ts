import Player from '#/engine/entity/Player.js';
import SimulatedPlayer from '#/engine/entity/SimulatedPlayer.js';
import { bankMarketService } from '#/engine/market/BankMarketService.js';

export function showBotStock(player: Player, bot: SimulatedPlayer): void {
    player.faceSquare(bot.x, bot.z);
    bot.faceSquare(player.x, player.z);
    bot.say('I sell what I gather through the Bank Market now.');
    bankMarketService.open(player);
}

export function talkToBot(player: Player, bot: SimulatedPlayer): void {
    player.faceSquare(bot.x, bot.z);
    bot.faceSquare(player.x, player.z);
    bot.say(`I'm ${bot.profile.goal.toLowerCase()}.`);
    player.messageGame(`${bot.displayName} is a ${bot.profile.role.replaceAll('_', ' ')} currently ${bot.profile.goal.toLowerCase()}.`);
    player.messageGame('Use Trade with to open the Bank Market.');
}
