const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// قواعد البيانات البسيطة في الذاكرة
const villages = new Map(); // القرى والإحداثيات
const shops = new Map();    // المحلات والملكية

// تسجيل أوامر السلاش (Slash Commands)
const commands = [
    // 1. أمر القرى
    new SlashCommandBuilder()
        .setName('village-set')
        .setDescription('تسجيل قرية جديدة وإحداثيات الرسبون')
        .addStringOption(opt => opt.setName('name').setDescription('اسم القرية').setRequired(true))
        .addStringOption(opt => opt.setName('coords').setDescription('إحداثيات الرسبون X Y Z').setRequired(true)),

    new SlashCommandBuilder()
        .setName('village-info')
        .setDescription('عرض معلومات قرية لاعب')
        .addUserOption(opt => opt.setName('user').setDescription('اللاعب').setRequired(true)),

    // 2. أمر المحلات
    new SlashCommandBuilder()
        .setName('shop-create')
        .setDescription('فتح محل جديد (يمنع تكرار نوع المحل)')
        .addStringOption(opt => opt.setName('type').setDescription('نوع المحل (مثال: صوف, خشب)').setRequired(true))
        .addStringOption(opt => opt.setName('shop_name').setDescription('اسم المحل').setRequired(true))
        .addStringOption(opt => opt.setName('coords').setDescription('إحداثيات المحل').setRequired(true)),

    new SlashCommandBuilder()
        .setName('shops-list')
        .setDescription('عرض سجل جميع المحلات المعتمدة'),

    // 3. أمر الشراء والإشعارات
    new SlashCommandBuilder()
        .setName('buy')
        .setDescription('شراء منتج وإرسال إشعار')
        .addUserOption(opt => opt.setName('seller').setDescription('صاحب المحل').setRequired(true))
        .addStringOption(opt => opt.setName('item').setDescription('المنتج المشترى').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('الكمية').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
    console.log(` تم تشغيل البوت بنجاح باسم: ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(' تم تسجيل جميع الأوامر بنجاح!');
    } catch (err) {
        console.error(err);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, user } = interaction;

    // --- نظام القرى ---
    if (commandName === 'village-set') {
        const name = options.getString('name');
        const coords = options.getString('coords');
        villages.set(user.id, { name, coords });
        return interaction.reply(` تم تسجيل قرية **${name}** بنجاح!\n📍 إحداثيات الرسبون: \`${coords}\``);
    }

    if (commandName === 'village-info') {
        const target = options.getUser('user');
        const data = villages.get(target.id);
        if (!data) return interaction.reply({ content: `❌ هذا اللاعب لم يسجل قرية بعد.`, ephemeral: true });
        
        const embed = new EmbedBuilder()
            .setTitle(`🏡 قرية اللاعب: ${target.username}`)
            .addFields(
                { name: 'اسم القرية', value: data.name, inline: true },
                { name: 'إحداثيات الرسبون', value: `\`${data.coords}\``, inline: true }
            )
            .setColor('Green');
        return interaction.reply({ embeds: [embed] });
    }

    // --- نظام المحلات ---
    if (commandName === 'shop-create') {
        const type = options.getString('type').toLowerCase();
        const shopName = options.getString('shop_name');
        const coords = options.getString('coords');

        if (shops.has(type)) {
            const existing = shops.get(type);
            return interaction.reply({ 
                content: `❌ **عذراً!** نوع المحل (**${type}**) مملوك بالفعل للاعب <@${existing.ownerId}>!`, 
                ephemeral: true 
            });
        }

        shops.set(type, { shopName, coords, ownerId: user.id, ownerTag: user.username });
        return interaction.reply(`🎉 تم اعتماد محلك **${shopName}** لنوع (**${type}**) بنجاح!\n📍 المكان: \`${coords}\``);
    }

    if (commandName === 'shops-list') {
        if (shops.size === 0) return interaction.reply(' لا توجد محلات مسجلة حالياً.');

        const embed = new EmbedBuilder()
            .setTitle('🏪 سجل المحلات المعتمدة في السيرفر')
            .setColor('Gold');

        shops.forEach((val, key) => {
            embed.addFields({
                name: `🛒 محل ${key} (${val.shopName})`,
                value: `المالك: <@${val.ownerId}>\nالموقع: \`${val.coords}\``
            });
        });

        return interaction.reply({ embeds: [embed] });
    }

    // --- نظام الشراء الإشعارات ---
    if (commandName === 'buy') {
        const seller = options.getUser('seller');
        const item = options.getString('item');
        const amount = options.getInteger('amount');

        const embed = new EmbedBuilder()
            .setTitle('🔔 عملية شراء جديدة!')
            .setDescription(`قام اللاعب ${user} بشراء **${amount}x ${item}** من محل ${seller}!`)
            .setColor('Blue')
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
});

client.login(process.env.TOKEN);
