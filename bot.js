require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// Quando o bot liga
client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
  client.user.setActivity('!ticket para abrir ticket', { type: 'WATCHING' });
});

// Quando alguém manda mensagem
client.on('messageCreate', async (message) => {
  // Ignora mensagens do bot
  if (message.author.bot) return;

  // Comando para mostrar o botão de ticket
  if (message.content === '!ticket') {
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('create_ticket')
          .setLabel('🎟️ Abrir Ticket')
          .setStyle(ButtonStyle.Primary)
      );

    await message.reply({
      content: '👇 Clique para abrir um ticket de suporte!',
      components: [row]
    });
  }

  // Comando para limpar tickets
  if (message.content === '!cleartickets') {
    if (!message.member.permissions.has('ManageChannels')) {
      return message.reply('❌ Você não tem permissão!');
    }
    message.reply('🧹 Deletando todos os tickets...');
  }

  // Comando para fixar a mensagem de tickets
  if (message.content === '!setticket') {
    if (!message.member.permissions.has('ManageChannels')) {
      return message.reply('❌ Você não tem permissão!');
    }

    const selectRow = new ActionRowBuilder()
      .addComponents(
        new (require('discord.js').StringSelectMenuBuilder)()
          .setCustomId('ticket_category')
          .setPlaceholder('Selecione a categoria do seu ticket')
          .addOptions(
            {
              label: 'Robux',
              value: 'robux',
              emoji: '<:emoji:1553891016090591283>'
            },
            {
              label: 'Tokens',
              value: 'tokens',
              emoji: '<:emoji:1547017084473708554>'
            },
            {
              label: 'Limiteds',
              value: 'limiteds',
              emoji: '<:emoji:1441471693632573640>'
            },
            {
              label: 'Venda-nos seus itens',
              value: 'venda',
              emoji: '<:emoji:1552160698191315066>'
            },
            {
              label: 'Suporte/Dúvida',
              value: 'suporte',
              emoji: '<:emoji:1350077832407154698>'
            }
          )
      );

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('🎟️ Crovv9 - Sistema de Tickets')
      .setDescription('Selecione a categoria do seu ticket abaixo!')
      .setColor('#FFD700');

    await message.reply({
      embeds: [embed],
      components: [selectRow]
    });

    await message.reply('✅ Mensagem de tickets criada! Todos podem selecionar a categoria agora!');
  }
});

// Cargos que podem ver/fechar tickets
const ALLOWED_ROLES = ['Vendedor', 'Admin', 'Mod', 'Dono', 'Co-Owner'];

// Quando alguém interage (botão ou select menu)
client.on('interactionCreate', async (interaction) => {
  // Handler para Select Menu
  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket_category') {
      const category = interaction.values[0];
      const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

      // Cria um Modal diferente pra cada categoria
      const modal = new ModalBuilder()
        .setCustomId(`modal_${category}`)
        .setTitle('Detalhes do Ticket');

      let questionText = '';
      switch(category) {
        case 'robux':
          questionText = 'Quantos Robux você deseja comprar?';
          break;
        case 'tokens':
          questionText = 'Quantos Tokens você deseja?';
          break;
        case 'limiteds':
          questionText = 'Qual limited/s você gostaria?';
          break;
        case 'venda':
          questionText = 'Qual item/quantidade você deseja vender?';
          break;
        case 'suporte':
          questionText = 'Qual é o problema ou dúvida?';
          break;
      }

      const textInput = new TextInputBuilder()
        .setCustomId('ticket_details')
        .setLabel(questionText)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const actionRow = new ActionRowBuilder().addComponents(textInput);
      modal.addComponents(actionRow);

      await interaction.showModal(modal);
      return;
    }
  }

  // Handler para Modal
  if (interaction.isModalSubmit()) {
    const modalId = interaction.customId;
    if (modalId.startsWith('modal_')) {
      const category = modalId.replace('modal_', '');
      const details = interaction.fields.getTextInputValue('ticket_details');
      const guild = interaction.guild;
      const user = interaction.user;

      const categoryNames = {
        'venda': details,
        'suporte': details,
        'robux': `${details}-rbx`,
        'limiteds': details,
        'tokens': `${details}-tokens`
      };

      const ticketName = `${categoryNames[category]}-${user.username}`;

      try {
        // Pega os IDs dos cargos permitidos
        const allowedRoleIds = [];
        for (const roleName of ALLOWED_ROLES) {
          const role = guild.roles.cache.find(r => r.name === roleName);
          if (role) allowedRoleIds.push(role.id);
        }

        // Constrói as permissões
        const permissionOverwrites = [
          {
            id: guild.id,
            deny: ['ViewChannel']
          },
          {
            id: user.id,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          },
          {
            id: client.user.id,
            allow: ['ViewChannel', 'SendMessages', 'ManageMessages']
          }
        ];

        // Adiciona permissões para os cargos
        for (const roleId of allowedRoleIds) {
          permissionOverwrites.push({
            id: roleId,
            allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
          });
        }

        // Cria o canal de ticket
        const ticket = await guild.channels.create({
          name: ticketName,
          type: ChannelType.GuildText,
          parent: null,
          permissionOverwrites: permissionOverwrites
        });

        const closeButton = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('close_ticket')
              .setLabel('❌ Fechar Ticket')
              .setStyle(ButtonStyle.Danger)
          );

        const categoryDisplay = {
          'venda': `Venda - ${details}`,
          'suporte': `Suporte/Dúvida - ${details}`,
          'robux': `Robux - ${details}`,
          'limiteds': `Limiteds - ${details}`,
          'tokens': `Tokens - ${details}`
        };

        await ticket.send({
          content: `Olá ${user}! 👋\n\n**Categoria:** ${categoryDisplay[category]}\n\nAguarde que alguém da equipe irá atender você em breve!`,
          components: [closeButton]
        });

        await interaction.reply({
          content: `✅ Ticket criado em ${ticket}!`,
          ephemeral: true
        });
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: '❌ Erro ao criar ticket!',
          ephemeral: true
        });
      }
    }
    return;
  }

  // Handler para Botões
  if (!interaction.isButton()) return;

  if (interaction.customId === 'create_ticket') {
    const guild = interaction.guild;
    const user = interaction.user;
    const ticketName = `${user.username}-pedido`;

    try {
      // Pega os IDs dos cargos permitidos
      const allowedRoleIds = [];
      for (const roleName of ALLOWED_ROLES) {
        const role = guild.roles.cache.find(r => r.name === roleName);
        if (role) allowedRoleIds.push(role.id);
      }

      // Constrói as permissões
      const permissionOverwrites = [
        {
          id: guild.id, // @everyone
          deny: ['ViewChannel']
        },
        {
          id: user.id, // O usuário que abriu
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        },
        {
          id: client.user.id, // O bot
          allow: ['ViewChannel', 'SendMessages', 'ManageMessages']
        }
      ];

      // Adiciona permissões para os cargos permitidos
      for (const roleId of allowedRoleIds) {
        permissionOverwrites.push({
          id: roleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
        });
      }

      // Cria um novo canal privado
      const ticket = await guild.channels.create({
        name: ticketName,
        type: ChannelType.GuildText,
        parent: null, // Deixa sem categoria, ou muda pra uma existente
        permissionOverwrites: permissionOverwrites
      });

      // Manda mensagem inicial
      const closeButton = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('❌ Fechar Ticket')
            .setStyle(ButtonStyle.Danger)
        );

      await ticket.send({
        content: `Olá ${user}! 👋\n\nBem-vindo ao seu ticket!\nDescreva seu problema aqui embaixo.`,
        components: [closeButton]
      });

      await interaction.reply({
        content: `✅ Ticket criado em ${ticket}!`,
        ephemeral: true // Só você vê
      });
    } catch (error) {
      console.error(error);
      await interaction.reply({
        content: '❌ Erro ao criar ticket!',
        ephemeral: true
      });
    }
  }

  // Botão para fechar ticket
  if (interaction.customId === 'close_ticket') {
    // Verifica se o usuário tem um dos cargos permitidos
    const hasPermission = interaction.member.roles.cache.some(role =>
      ALLOWED_ROLES.includes(role.name)
    );

    if (!hasPermission) {
      return interaction.reply({
        content: '❌ Apenas Vendedores, Admins, Mods, Donos e Co-Owners podem fechar tickets!',
        ephemeral: true
      });
    }

    await interaction.reply('⏳ Deletando ticket em 3 segundos...');
    setTimeout(() => {
      interaction.channel.delete();
    }, 3000);
  }
});

// Login do bot
client.login(process.env.DISCORD_TOKEN);
