require('dotenv').config();
const RouterOSAPI = require('node-routeros').RouterOSAPI;
const { Client, LocalAuth } = require('whatsapp-web.js');
const axios = require('axios');
const qrcode = require('qrcode-terminal');

// Deklarasi connection di level tertinggi
let connection = null;

// Inisialisasi WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ],
        headless: true
    }
});

// Event handler untuk QR code
client.on('qr', (qr) => {
    console.log('QR Code diterima, silakan scan:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp Client siap!');
    monitorPPPoE();
});

client.on('authenticated', () => {
    console.log('WhatsApp berhasil diautentikasi!');
});

client.on('auth_failure', (msg) => {
    console.error('Autentikasi WhatsApp gagal:', msg);
});

client.on('disconnected', (reason) => {
    console.log('WhatsApp terputus:', reason);
    client.initialize(); // Coba reconnect
});

// Jika Anda memiliki server HTTP atau aplikasi lain yang memerlukan port
const port = process.env.PORT || 3000;

// Contoh penggunaan port jika Anda memiliki server Express
// const express = require('express');
// const app = express();
// app.listen(port, () => {
//     console.log(`Server running on port ${port}`);
// });

async function sendMessage(number, message) {
    try {
        // Pastikan format nomor benar
        const formattedNumber = number.includes('@g.us') 
            ? number 
            : `${number.replace(/\D/g, '')}@c.us`;
        
        await client.sendMessage(formattedNumber, message);
        console.log('Pesan terkirim ke:', formattedNumber);
    } catch (error) {
        console.error('Error mengirim pesan:', error);
    }
}

async function getOfflineUsers() {
    try {
        const allUsers = await connection.write('/ppp/secret/print');
        const activeUsers = await connection.write('/ppp/active/print');
        const activeUsernames = new Set(activeUsers.map(user => user.name));
        
        // Filter user yang offline (ada di secret tapi tidak aktif)
        return allUsers
            .filter(user => !activeUsernames.has(user.name))
            .map(user => user.name);
    } catch (error) {
        console.error('Error getting offline users:', error);
        return [];
    }
}

async function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
    }).format(date);
}

async function connectToMikrotik() {
    try {
        connection = new RouterOSAPI({
            host: process.env.MIKROTIK_IP,
            user: process.env.MIKROTIK_USER,
            password: process.env.MIKROTIK_PASSWORD,
            port: parseInt(process.env.MIKROTIK_PORT) || 8728,
            timeout: 15000
        });

        await connection.connect();
        console.log('Terhubung ke MikroTik');
        return true;
    } catch (error) {
        console.error('Error koneksi ke MikroTik:', error);
        return false;
    }
}

async function ensureConnection() {
    if (!connection || !connection.connected) {
        await connectToMikrotik();
    }
}

async function monitorPPPoE() {
    let previousUsers = null;
    
    try {
        await connectToMikrotik();
        
        const initialUsers = await connection.write('/ppp/active/print');
        previousUsers = new Set(initialUsers.map(user => user.name));
        console.log(`Sistem dimulai dengan ${previousUsers.size} user aktif`);

        setInterval(async () => {
            try {
                const activeUsers = await connection.write('/ppp/active/print');
                const currentUsers = new Set(activeUsers.map(user => user.name));

                // Cek user yang baru login
                for (const user of currentUsers) {
                    if (!previousUsers.has(user)) {
                        const userInfo = activeUsers.find(u => u.name === user);
                        const offlineUsers = await getOfflineUsers();
                        const currentTime = await formatDate(new Date());

                        let message = `${process.env.HEADER}\n` +
                                    `*${user} LOGIN*\n` +
                                    `IP: ${userInfo?.address || 'unknown'}\n` +
                                    `MAC: ${userInfo?.['caller-id'] || 'unknown'}\n` +
                                    `Waktu: ${currentTime}\n\n`;

                        if (offlineUsers.length > 0) {
                            message += `📊 *DAFTAR USER OFFLINE:*\n`;
                            offlineUsers.forEach((offlineUser, index) => {
                                message += `${index + 1}. ${offlineUser}\n`;
                            });
                        }

                        if (process.env.ADMIN_NUMBER) {
                            await sendMessage(process.env.ADMIN_NUMBER, message);
                        }
                        if (process.env.TECH_GROUP_ID) {
                            await sendMessage(process.env.TECH_GROUP_ID, message);
                        }
                    }
                }

                // Cek user yang logout
                for (const user of previousUsers) {
                    if (!currentUsers.has(user)) {
                        const currentTime = await formatDate(new Date());
                        const message = `${process.env.HEADER}\n` +
                                      `*${user} LOGOUT*\n` +
                                      `Waktu: ${currentTime}`;

                        if (process.env.ADMIN_NUMBER) {
                            await sendMessage(process.env.ADMIN_NUMBER, message);
                        }
                        if (process.env.TECH_GROUP_ID) {
                            await sendMessage(process.env.TECH_GROUP_ID, message);
                        }
                    }
                }

                previousUsers = currentUsers;

            } catch (error) {
                console.error('Error monitoring PPPoE:', error);
            }
        }, 5000);

    } catch (error) {
        console.error('Error koneksi:', error.message);
        setTimeout(monitorPPPoE, 30000);
    }
}

async function addPPPoEUser(username, password, profile) {
    try {
        await connection.connect();
        const channel = await connection.openChannel();
        channel.write(['/ppp/secret/add', `=name=${username}`, `=password=${password}`, `=profile=${profile}`]);
        console.log(`User ${username} added successfully.`);
    } catch (error) {
        console.error('Error adding PPPoE user:', error);
    }
}

async function editPPPoEUser(username, newProfile) {
    try {
        await connection.connect();
        const channel = await connection.openChannel();
        channel.write(['/ppp/secret/set', `=numbers=${username}`, `=profile=${newProfile}`]);
        console.log(`User ${username} profile updated to ${newProfile}.`);
    } catch (error) {
        console.error('Error editing PPPoE user:', error);
    }
}

async function deletePPPoEUser(username) {
    try {
        await connection.connect();
        const channel = await connection.openChannel();
        channel.write(['/ppp/secret/remove', `=numbers=${username}`]);
        console.log(`User ${username} deleted successfully.`);
    } catch (error) {
        console.error('Error deleting PPPoE user:', error);
    }
}

async function checkActivePPPoEUsers() {
    try {
        await connection.connect();
        const channel = await connection.openChannel();
        channel.write('/ppp/active/print', (err, data) => {
            if (err) {
                console.error('Error fetching active PPPoE users:', err);
                return;
            }
            const activeUsers = data.map(user => user.name).join(', ');
            sendMessage(process.env.ADMIN_NUMBER, `📊 *DAFTAR USER ONLINE:*\n${activeUsers}`);
        });
    } catch (error) {
        console.error('Error checking active PPPoE users:', error);
    }
}

async function addHotspotUser(username, password, profile) {
    try {
        await connection.connect();
        const channel = await connection.openChannel();
        channel.write(['/ip/hotspot/user/add', `=name=${username}`, `=password=${password}`, `=profile=${profile}`]);
        console.log(`Hotspot user ${username} added successfully.`);
    } catch (error) {
        console.error('Error adding Hotspot user:', error);
    }
}

async function deleteHotspotUser(username) {
    try {
        await connection.connect();
        const channel = await connection.openChannel();
        channel.write(['/ip/hotspot/user/remove', `=numbers=${username}`]);
        console.log(`Hotspot user ${username} deleted successfully.`);
    } catch (error) {
        console.error('Error deleting Hotspot user:', error);
    }
}

async function checkActiveHotspotUsers() {
    try {
        await connection.connect();
        const channel = await connection.openChannel();
        channel.write('/ip/hotspot/active/print', (err, data) => {
            if (err) {
                console.error('Error fetching active Hotspot users:', err);
                return;
            }
            const activeUsers = data.map(user => user.user).join(', ');
            sendMessage(process.env.ADMIN_NUMBER, `📊 *DAFTAR USER HOTSPOT ONLINE:*\n${activeUsers}`);
        });
    } catch (error) {
        console.error('Error checking active Hotspot users:', error);
    }
}

client.on('message', async message => {
    if (message.from === `${process.env.ADMIN_NUMBER}@c.us`) {
        const args = message.body.trim().split(' ');
        const command = args[0].toLowerCase();

        // Handler untuk addhs
        if (command === 'addhs') {
            try {
                await ensureConnection();

                if (args.length !== 4) {
                    await message.reply('Format salah! Gunakan: addhs username password profile');
                    return;
                }

                const username = args[1];
                const password = args[2];
                const profile = args[3];

                await connection.write('/ip/hotspot/user/add', [
                    '=name=' + username,
                    '=password=' + password,
                    '=profile=' + profile
                ]);

                const responseMessage = `${process.env.HEADER}\n` +
                                     `✅ *HOTSPOT USER DITAMBAHKAN*\n\n` +
                                     `👤 Username: *${username}*\n` +
                                     `📋 Profile: *${profile}*\n\n` +
                                     `Status: Berhasil`;

                await message.reply(responseMessage);
                console.log(`Hotspot user ${username} ditambahkan dengan profile ${profile}`);

            } catch (error) {
                const errorMessage = `${process.env.HEADER}\n` +
                                   `❌ *GAGAL MENAMBAHKAN USER*\n\n` +
                                   `Error: ${error.message}`;
                                   
                await message.reply(errorMessage);
                console.error('Error adding hotspot user:', error);
            }
            return;
        }

        // Handler untuk editpppoe
        if (command === 'editpppoe') {
            try {
                await ensureConnection();

                if (args.length !== 3) {
                    await message.reply('Format salah! Gunakan: editpppoe username profile_baru');
                    return;
                }

                const username = args[1];
                const newProfile = args[2];

                // 1. Edit profile user di secret
                await connection.write('/ppp/secret/set', [
                    '=numbers=' + (await connection.write('/ppp/secret/print', [
                        '=.proplist=.id',
                        '?name=' + username
                    ]))[0]['.id'],
                    '=profile=' + newProfile
                ]);

                // 2. Cari dan remove sesi aktif user
                const activeSessions = await connection.write('/ppp/active/print', [
                    '?name=' + username
                ]);

                if (activeSessions.length > 0) {
                    // Hapus sesi aktif user
                    await connection.write('/ppp/active/remove', [
                        '=numbers=' + activeSessions[0]['.id']
                    ]);
                }

                const responseMessage = `${process.env.HEADER}\n` +
                                     `✅ *PPPoE USER DIUPDATE*\n\n` +
                                     `👤 Username: *${username}*\n` +
                                     `📋 Profile Baru: *${newProfile}*\n\n` +
                                     `Status: Berhasil\n` +
                                     `${activeSessions.length > 0 ? '🔄 Sesi aktif telah dihapus' : ''}`;

                await message.reply(responseMessage);
                console.log(`PPPoE user ${username} diupdate ke profile ${newProfile}`);

            } catch (error) {
                const errorMessage = `${process.env.HEADER}\n` +
                                   `❌ *GAGAL MENGUPDATE USER*\n\n` +
                                   `Error: ${error.message}`;
                                   
                await message.reply(errorMessage);
                console.error('Error updating pppoe user:', error);
            }
            return;
        }

        // Handler untuk perintah lainnya
        switch (command) {
            case 'menu':
            case 'bantuan':
                const helpMessage = `
*Daftar Perintah:*
1. *addpppoe username password profile* - Tambah user PPPoE
2. *editpppoe username profile_baru* - Edit profil user PPPoE
3. *delpppoe username* - Hapus user PPPoE
4. *cekpppoe* - Cek user PPPoE yang aktif
5. *addhs username password profile* - Tambah user Hotspot
6. *delhs username* - Hapus user Hotspot
7. *cekhs* - Cek user Hotspot yang aktif
`;
                await message.reply(helpMessage);
                break;
            case 'addpppoe':
                if (args.length === 4) {
                    await addPPPoEUser(args[1], args[2], args[3]);
                    sendMessage(message.from, `User PPPoE ${args[1]} berhasil ditambahkan.`);
                } else {
                    sendMessage(message.from, 'Format perintah salah. Gunakan: addpppoe username password profile');
                }
                break;
            case 'delpppoe':
                if (args.length === 2) {
                    await deletePPPoEUser(args[1]);
                    sendMessage(message.from, `User PPPoE ${args[1]} berhasil dihapus.`);
                } else {
                    sendMessage(message.from, 'Format perintah salah. Gunakan: delpppoe username');
                }
                break;
            case 'cekpppoe':
                await checkActivePPPoEUsers();
                break;
            case 'delhs':
                if (args.length === 2) {
                    await deleteHotspotUser(args[1]);
                    sendMessage(message.from, `User Hotspot ${args[1]} berhasil dihapus.`);
                } else {
                    sendMessage(message.from, 'Format perintah salah. Gunakan: delhs username');
                }
                break;
            case 'cekhs':
                await checkActiveHotspotUsers();
                break;
            default:
                sendMessage(message.from, 'Perintah tidak dikenal.');
        }
    }
});

// Inisialisasi WhatsApp client
client.initialize().catch(err => {
    console.error('Error saat inisialisasi client:', err);
});

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Menutup koneksi...');
    if (connection && connection.connected) {
        await connection.close();
    }
    process.exit();
});

// Pastikan ini ada di akhir file
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
}); 