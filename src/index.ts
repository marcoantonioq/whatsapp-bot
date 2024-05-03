import NodeCache from "node-cache";
import makeWASocket, {
  delay,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger";
import { EventEmitter } from "events";

// Configuração do logger
const logger = MAIN_LOGGER.child({});
logger.level = "error";

// Definição de tipos
interface MessageUpsert {
  type: string;
  messages: any[];
}

export type MessageCallback = (msg: any) => void;

class WhatsAppBot {
  private msgRetryCounterCache: NodeCache;
  private sock: any; // Altere o tipo conforme necessário
  private eventEmitter: EventEmitter;

  constructor() {
    // Inicialização dos membros da classe
    this.msgRetryCounterCache = new NodeCache();
    this.eventEmitter = new EventEmitter();
  }

  // Método para iniciar o bot
  async start(): Promise<void> {
    try {
      const { state, saveCreds } = await useMultiFileAuthState(
        "baileys_auth_info"
      );
      const { version } = await fetchLatestBaileysVersion();

      // Inicialização do socket
      this.sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: state.keys },
        msgRetryCounterCache: this.msgRetryCounterCache,
        printQRInTerminal: true,
        logger,
      });

      // Gerenciamento de eventos
      this.sock.ev.on("creds.update", async () => {
        await saveCreds();
      });
      this.sock.ev.on("messages.upsert", this.handleMessageUpsert);
    } catch (error) {
      console.log("Erro ao iniciar o bot!!!");
    }
  }

  // Método para lidar com a chegada de novas mensagens
  private handleMessageUpsert = (upsert: MessageUpsert): void => {
    for (const msg of upsert.messages) {
      this.eventEmitter.emit("message", msg);
    }
  };

  // Método para se inscrever em eventos de novas mensagens
  onMessage(callback: MessageCallback): void {
    this.eventEmitter.on("message", callback);
  }

  // Método para enviar uma mensagem
  async sendMessage(remoteJid: string, message: string): Promise<void> {
    await this.sock.presenceSubscribe(remoteJid);
    await delay(500);
    await this.sock.sendPresenceUpdate("composing", remoteJid);
    await delay(2000);
    await this.sock.sendPresenceUpdate("paused", remoteJid);
    await this.sock.sendMessage(remoteJid, { text: message });
  }
}

// Criação e inicialização do bot
const bot = new WhatsAppBot();
bot.start();

// Exemplo de uso: inscrever-se ao evento de mensagem recebida
bot.onMessage(async(msg) => {
  if (!msg.key.fromMe) {
    try {
      console.log("Received message:", msg);
      // await sock!.readMessages([msg.key]);
      // await bot.sendMessage("556284972385@s.whatsapp.net","Nova mensagem!!!");
    } catch (error) {
      console.log("Error while accessing message:", error);
    }
  }
});
