const knex = require('./../database');
const bcrypt = require('bcrypt');
const jwt =require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;

// Configuração do Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

async function sendResetEmail(email, token) {
    // Apenas retorna o token para desenvolvimento
    console.log('Token gerado:', token);
    return token;
}

module.exports={
    async create(req, res){
        try {
            const { nome } = req.body;
            const { email } = req.body;
            const { uf } = req.body;
            const { level } = req.body;
            const password = await bcrypt.hash(req.body.password, 10);
            
            const result = await knex('clientes').where({ email });
            if (result.length === 1){
                return res.status(400).send({ erro: 'Email já cadastrtado'});
            }
            await knex('clientes')
                .insert({ nome, email, uf, level, password });
                return res.status(201).send( { nome, email, uf, level, password});
        } catch (error) {
            return res.status(400).json({error: error.message});
        }
    },
    async searchUsersAll(req, res){
        try {
            const result = await knex('clientes');
            return res.status(200).send(result);
            
        } catch (error) {
            return res.status(400).json({error: error.message});
        }
    },

    async searcherUser(req, res) {
        try {
            const { email } = req.body;
            const { password } = req.body;

            if(email == undefined || password == undefined) {
                console.log('Erro de requisição - requisição sem email ou senha');
                return res.status(401).send({mensagem:'Erro de requisição - requisição sem email ou senha'});
            }

            // Log do email recebido
            console.log('Tentando login com email:', email);

            // Busca todos os usuários para debug
            const allUsers = await knex('clientes').select('*');
            console.log('Todos os usuários no banco:', allUsers);

            // Busca o usuário específico ignorando maiúsculas/minúsculas
            const [result] = await knex('clientes')
                .whereRaw('LOWER(email) = ?', [email.toLowerCase()])
                .select('*');
            
            console.log('Usuário encontrado:', result);

            if(result) {
                // Convertendo para Promise para melhor tratamento de erros
                const passwordMatch = await bcrypt.compare(password, result.password);
                console.log('Senha corresponde:', passwordMatch);

                if(passwordMatch) {
                    const token = jwt.sign({
                        idUser: result.id,
                        nome: result.nome,
                        email: result.email,
                        level: result.level,
                        codcli: result.codcli
                    }, 'segredo', {expiresIn: '1h'});

                    return res.status(200).send({
                        token: token,
                        codcli: result.codcli,
                        mensagem: 'Autenticação - realizada com sucesso !!!'
                    });
                } else {
                    console.log('Senha incorreta para o email:', email);
                    return res.status(401).send({mensagem:'Falha na autenticação - Senha incorreta !!!'});
                }
            } else {
                console.log('Email não encontrado:', email);
                return res.status(401).send({mensagem:'Falha na autenticação - email incorreto !!!'});
            }
        } catch(error) {
            console.error('Erro no login:', error);
            return res.status(400).json({error: error.message});
        }
    },

    async updateClient(req, res) {
        try {
          const { codcli } = req.params;
          const { nome, email, uf, password } = req.body;
      
          // Busca o cliente na tabela correta
          const result = await knex('clientes').where({ codcli });
          if (result.length === 1) {
            // Monta o objeto de update apenas com os campos enviados
            const updateData = {};
            if (nome) updateData.nome = nome;
            if (email) updateData.email = email;
            if (uf) updateData.uf = uf;
            // Não permite alterar o level!
            if (password) {
              updateData.password = await bcrypt.hash(password, 10);
            }
      
            await knex('clientes').update(updateData).where({ codcli });
            return res.status(201).send();
          } else {
            return res.status(400).send({ error: 'Código do cliente inválido !!!' });
          }
        } catch (error) {
          return res.status(400).json({ error: error.message });
        }
    },

    async updatePassword(req, res) {
        try {
            const { codcli } = req.params;
            const { currentPassword, newPassword } = req.body;

            // Busca o cliente
            const [user] = await knex('clientes').where({ codcli });
            if (!user) {
                return res.status(404).send({ error: 'Cliente não encontrado' });
            }

            // Verifica a senha atual
            const passwordMatch = await bcrypt.compare(currentPassword, user.password);
            if (!passwordMatch) {
                return res.status(401).send({ error: 'Senha atual incorreta' });
            }

            // Atualiza para a nova senha
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await knex('clientes').update({ password: hashedPassword }).where({ codcli });

            return res.status(200).send({ message: 'Senha atualizada com sucesso' });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    },

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            const [user] = await knex('clientes').where({ email });
            if (!user) {
                return res.status(404).send({ error: 'E-mail não encontrado' });
            }

            // Gera token
            const token = crypto.randomBytes(20).toString('hex');
            const expires = new Date(Date.now() + 3600000); // 1 hora

            // Salva o token e expiração no banco
            await knex('clientes')
                .update({ 
                    reset_token: token, 
                    reset_token_expires: expires 
                })
                .where({ email });

            // Retorna o token para o frontend
            return res.status(200).send({ 
                message: 'Token gerado com sucesso',
                token: token,
                expires: expires
            });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    },

    async resetPassword(req, res) {
        try {
            const { token, newPassword } = req.body;
            const now = new Date();

            // Busca usuário pelo token e verifica validade
            const [user] = await knex('clientes')
                .where({ reset_token: token })
                .andWhere('reset_token_expires', '>', now);

            if (!user) {
                return res.status(400).send({ error: 'Token inválido ou expirado' });
            }

            // Atualiza senha e remove o token
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await knex('clientes')
                .update({ 
                    password: hashedPassword, 
                    reset_token: null, 
                    reset_token_expires: null 
                })
                .where({ codcli: user.codcli });

            return res.status(200).send({ message: 'Senha redefinida com sucesso' });
        } catch (error) {
            return res.status(400).json({ error: error.message });
        }
    },

    async deleteClient(req, res) {
        try {
            const { codcli } = req.params;
            console.log('Tentando deletar cliente com código:', codcli, 'Tipo:', typeof codcli);
            
            // Verifica se o cliente existe
            const result = await knex('clientes').where({ codcli });
            console.log('Resultado da busca:', result);

            if (result.length === 0) {
                console.log('Cliente não encontrado');
                return res.status(404).send({ error: 'Cliente não encontrado' });
            }

            // Deleta o cliente
            const delResult = await knex('clientes').where({ codcli }).del();
            console.log('Resultado do delete:', delResult);

            if (delResult === 0) {
                return res.status(400).send({ error: 'Não foi possível deletar o cliente' });
            }

            return res.status(200).send({ message: 'Cliente deletado com sucesso' });
        } catch (error) {
            console.error('Erro ao deletar cliente:', error);
          return res.status(400).json({ error: error.message });
        }
        
    },

    async atualizarFotoPerfil(req, res) {
        try {
            const { codcli } = req.params;
            const { fotoPerfil } = req.body;

            if (!fotoPerfil) {
                return res.status(400).json({ error: 'URL da foto é obrigatória.' });
            }

            // Verifica se o usuário existe
            const [user] = await knex('clientes').where({ codcli });
            if (!user) {
                return res.status(404).json({ error: 'Usuário não encontrado.' });
            }

            // Se já existe uma foto antiga, deleta do Cloudinary
            if (user.foto_perfil) {
                const publicId = user.foto_perfil.split('/').pop().split('.')[0];
                await cloudinary.uploader.destroy(publicId);
            }

            // Atualiza a foto no banco de dados
            await knex('clientes')
                .where({ codcli })
                .update({ foto_perfil: fotoPerfil });

            return res.status(200).json({ 
                success: true, 
                message: 'Foto de perfil atualizada com sucesso',
                fotoPerfil 
            });

        } catch (error) {
            console.error('Erro ao atualizar foto de perfil:', error);
            return res.status(500).json({ 
                error: 'Erro ao atualizar foto de perfil',
                details: error.message 
            });
        }
    }
}
