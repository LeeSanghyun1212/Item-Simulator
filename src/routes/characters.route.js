// src/routes/CreateCharacter.route.js

import express from 'express';
import authMiddleware from '../../middlewares/auth.middleware.js'; // 인증 미들웨어
import { prisma } from '../utils/prisma/index.js';

const router = express.Router();

// 캐릭터 생성
router.post('/Character', authMiddleware, async (req, res) => {
    const { name } = req.body;

    try {
        // 캐릭터 이름 중복 확인
        const existingCharacter = await prisma.character.findUnique({
            where: {
                name,
            }
        });
        if (existingCharacter) {
            return res.status(409).json({ message: '이미 존재하는 캐릭터 명입니다.' });
        }
        // 새 캐릭터 생성
        const newCharacter = await prisma.character.create({
            data: {
                name,
                health: 500,
                power: 100,
                money: 10000,
                userId: req.user.id // 인증된 사용자 ID
            }
        });

        return res.status(201).json({ message: '캐릭터 생성 성공', characterId: newCharacter.id });
    } catch (error) {
        console.error('캐릭터 생성 중 오류 발생:', error);
        return res.status(500).json({ message: '서버 오류' });
    }
});
// 캐릭터 삭제
router.delete('/Character/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        //db에서 캐릭이 있는지 확인 필요
        const existedCharacter = await prisma.character.findFirst({
            where: {
                id: parseInt(id),
                userId: userId // 본인 계정인지 확인함
            }
        });

        if (!existedCharacter) {
            return res.status(409).json({ message: '삭제 권한이 없거나 캐릭터가 존재하지 않습니다' })
        }
        // db에 delete  쏴야 함 
        await prisma.character.delete({
            where: {
                id: parseInt(id),
            }
        });
        return res.status(201).json({ message: '캐릭터가 삭제되었습니다.' });
    } catch (error) {
        console.error('캐릭터 삭제 중 오류 발생:', error);
        return res.status(500).json({ message: '서버 오류' });
    }
});
// 캐릭터 조회
router.get('/Character/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        //남이 나의 캐릭터를 조회
        const character = await prisma.character.findUnique({
            where: {
                id: parseInt(id),
            }
        })
        if (!character) {
            return res.status(404).json({ message: '캐릭터가 존재하지 않습니다.' });
        }
        if (character.userId === userId) { // 본인 일시
            return res.status(200).json({
                name: character.name,
                health: character.health,
                power: character.power,
                money: character.money
            });
        }

        // 남일시 
        return res.status(200).json({
            name: character.name,
            health: character.health,
            power: character.power
        });

    } catch (error) {
        console.error('캐릭터 삭제 중 오류 발생:', error);
        return res.status(500).json({ message: '서버 오류' });
    }
});

export default router;
