// src/routes/item.route.js
import express from 'express';
import { prisma } from '../utils/prisma/index.js';
import authMiddleware from '../../middlewares/auth.middleware.js';

const router = express.Router();

// 아이템 생성
router.post('/items', async (req, res) => {
    const { item_code, item_name, item_stat, item_price } = req.body;
    try {
        const existingItem = await prisma.item.findUnique({
            where: { item_code }
        });

        if (existingItem) {
            return res.status(400).json({ error: '이미 존재하는 아이템 코드입니다.' });
        }
        if (!item_code || !item_name || !item_stat || !item_price) {
            return res.status(400).json({ message: '모든 필드를 제공해야 합니다.' });
        }
        const newItem = await prisma.item.create({
            data: {
                item_code,
                item_name,
                item_stat: item_stat,
                item_price,
            },
        });
        return res.status(201).json({ message: '새로운 아이템 생성', newItem });
    } catch (error) {
        console.error('아이템 생성 중 오류 발생:', error);
        return res.status(500).json({ message: '서버 오류' });
    }
});

// 아이템을 수정
router.put('/items/:item_code', async (req, res) => {
    const { item_code } = req.params;
    const { item_name, item_stat, item_price } = req.body;

    if (item_price !== undefined) {
        return res.status(400).json({ message: '아이템 가격은 수정할 수 없습니다.' });
    }
    try {
        const updatedItem = await prisma.item.update({
            where: { item_code: parseInt(item_code) }, // 아이템 코드로 검색
            data: {
                item_name: item_name,  // 아이템 명 수정
                item_stat: item_stat,  // 아이템 능력 수정
            },
        });

        res.status(200).json(updatedItem);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '아이템 수정 중 오류가 발생했습니다.' });
    }
});

// 모든 아이템을 조회
router.get('/items', async (req, res) => {
    try {
        const items = await prisma.item.findMany({
            select: {
                item_code: true, //true로 설정해주면 해당 필드를 반환함.
                item_name: true,
                item_price: true,
            },
        });

        res.status(200).json(items);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '아이템 목록 조회 중 오류가 발생했습니다.' });
    }
});

router.get('/items/:item_code/detail', async (req, res) => {
    const { item_code } = req.params;

    try {
        // 특정 아이템을 아이템 코드로 조회
        const item = await prisma.item.findUnique({
            where: { item_code: parseInt(item_code) },
            select: {
                item_code: true,
                item_name: true,
                item_stat: true,
                item_price: true,
            },
        });

        if (item) {
            res.status(200).json(item);
        } else {
            res.status(404).json({ message: '아이템을 찾을 수 없습니다.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: '아이템 상세 조회 중 오류가 발생했습니다.' });
    }
});

// 아이템 구입
router.post('/items/:character_id/purchase', authMiddleware, async (req, res) => {
    const { character_id } = req.params;
    const items = req.body; // [{ item_code: 1, count: 2 }, { item_code: 3, count: 1 }] < 형태로 body에 작성

    try {
        // 캐릭터가 있는지 확인
        const character = await prisma.character.findUnique({
            where: { id: parseInt(character_id) }
        });

        if (!character) {
            return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        }
        // 총 구매가격
        let totalPrice = 0;

        // 아이템 구매
        for (const { item_code, count } of items) {
            // 아이템 조회
            const item = await prisma.item.findUnique({
                where: { item_code }
            });

            if (!item) {
                return res.status(404).json({ message: `아이템 코드 ${item_code}을(를) 찾을 수 없습니다.` });
            }

            const itemTotalPrice = item.item_price * count;
            totalPrice += itemTotalPrice;
            // 너무 비쌀때
            if (character.money < totalPrice) {
                return res.status(400).json({ message: '게임 머니가 부족합니다.' });
            }

            // 돈 차감
            await prisma.character.update({
                where: { id: parseInt(character_id) },
                data: { money: character.money - totalPrice }
            });

            // 아이템 인벤토리에 추가
            const addinventory = await prisma.inventory.findFirst({
                where: {
                    character_id: parseInt(character_id),
                    item_code
                }
            });

            if (addinventory) {
                // 아이템 수량 업데이트
                await prisma.inventory.update({
                    where: { id: addinventory.id },
                    data: {
                        quantity: addinventory.quantity + count
                    }
                });
            } else {
                // 새로운 아이템 추가
                await prisma.inventory.create({
                    data: {
                        character_id: parseInt(character_id),
                        item_code,
                        quantity: count
                    }
                });
            }
        }
        res.status(200).json({ message: '아이템 구매 성공', remainingMoney: character.money - totalPrice });
    } catch (error) {
        console.error('아이템 구입 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 구입 중 오류가 발생했습니다.' });
    }
});

// 아이템 판매
router.post('/items/:character_id/sell', authMiddleware, async (req, res) => {
    const { character_id } = req.params;
    const items = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: '유효한 아이템 목록이 필요합니다.' });
    }
    // items 배열의 각 항목이 올바른 형식인지 확인
    for (const item of items) {
        if (typeof item.item_code !== 'number' || typeof item.count !== 'number') {
            console.log('Invalid item:', item); // 추가된 로그
            return res.status(400).json({ message: '아이템 목록의 형식이 올바르지 않습니다.' });
        }
    }

    try {
        // 캐릭터 조회 및 인벤토리 포함
        const character = await prisma.character.findUnique({
            where: { id: parseInt(character_id) },
            include: { inventory: true } // character 모델에 있는 inventory 데이터를 다 가져옴.
        });

        if (!character) {
            return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        }

        let totalAmount = 0;
        for (const { item_code, count } of items) {
            // 인벤토리에서 아이템 찾기
            const inventoryItem = character.inventory.find(inv => inv.item_code === item_code);
            if (!inventoryItem || inventoryItem.quantity < count) {
                return res.status(400).json({ message: `아이템 코드 ${item_code}가 부족하거나 존재하지 않습니다.` });
            }

            // 아이템 가격 조회
            const itemData = await prisma.item.findUnique({
                where: { item_code }
            });
            if (!itemData) {
                return res.status(404).json({ message: `아이템 코드 ${item_code}를 찾을 수 없습니다.` });
            }

            const salePrice = itemData.item_price * 0.6;
            totalAmount += salePrice * count;

            // 인벤토리에서 아이템 수량 업데이트
            await prisma.inventory.updateMany({
                where: {
                    character_id: parseInt(character_id),
                    item_code,
                    quantity: { gte: count }
                },
                data: {
                    quantity: { decrement: count }
                }
            });

            // 인벤토리에서 수량이 0인 아이템 삭제
            await prisma.inventory.deleteMany({
                where: {
                    character_id: parseInt(character_id),
                    item_code,
                    quantity: 0
                }
            });
        }

        // 캐릭터의 게임 머니 업데이트
        const updatedCharacter = await prisma.character.update({
            where: { id: parseInt(character_id) },
            data: {
                money: { increment: totalAmount }
            }
        });

        res.status(200).json({ message: '아이템 판매 성공', new_balance: updatedCharacter.money });
    } catch (error) {
        console.error('아이템 판매 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 판매 중 오류가 발생했습니다.' });
    }
});

//캐릭터 아이템 조회
router.get('/characters/:character_id/inventory', authMiddleware, async (req, res) => {
    const { character_id } = req.params;

    try {
        // 캐릭터가 있는지 확인
        const character = await prisma.character.findUnique({
            where: { id: parseInt(character_id) },
            include: { inventory: { include: { item: true } } }
        });

        if (!character) {
            return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        }

        // 인벤토리 아이템 목록 생성
        const inventoryItems = character.inventory.map(inv => ({
            item_code: inv.item.item_code,
            item_name: inv.item.item_name,
            count: inv.quantity
        }));

        res.status(200).json(inventoryItems);
    } catch (error) {
        console.error('아이템 목록 조회 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 아이템 장착
router.post('/characters/:character_id/equip', authMiddleware, async (req, res) => {
    const { character_id } = req.params;
    const item_code = parseInt(req.body.item_code);

    // 아이템 코드가 유효한지 체크
    if (isNaN(item_code)) {
        return res.status(400).json({ message: '유효한 아이템 코드가 필요합니다.' });
    }

    try {
        const character = await prisma.character.findUnique({
            where: { id: parseInt(character_id) },
            include: { inventory: true }
        });

        if (!character) {
            return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        }

        // 인벤토리에서 아이템 찾기
        const inventoryItem = character.inventory.find(inv => inv.item_code === item_code);

        if (!inventoryItem) {
            console.log('인벤토리 아이템:', character.inventory);
            return res.status(404).json({ message: '인벤토리에 해당 아이템이 존재하지 않습니다.' });
        }

        // 아이템이 껴져있는지 확인
        const equippedItem = await prisma.characterItem.findUnique({
            where: {
                characterId_itemCode: {
                    characterId: parseInt(character_id),
                    itemCode: item_code
                }
            }
        });

        if (equippedItem) {
            return res.status(400).json({ message: '이미 장착된 아이템입니다.' });
        }

        const itemData = await prisma.item.findUnique({
            where: { item_code }
        });

        if (!itemData) {
            return res.status(404).json({ message: '아이템 정보를 찾을 수 없습니다.' });
        }

        // 캐릭터 스탯 업데이트
        const updatedCharacter = await prisma.character.update({
            where: { id: parseInt(character_id) },
            data: {
                health: { increment: itemData.item_stat.health || 0 },
                power: { increment: itemData.item_stat.power || 0 }
            }
        });

        // 캐릭터-아이템 테이블에 추가
        await prisma.characterItem.create({
            data: {
                characterId: parseInt(character_id),
                itemCode: item_code
            }
        });

        // 인벤토리에서 아이템 수량 업데이트
        if (inventoryItem.quantity === 1) {
            await prisma.inventory.deleteMany({
                where: {
                    character_id: parseInt(character_id),
                    item_code
                }
            });
        } else {
            await prisma.inventory.updateMany({
                where: {
                    character_id: parseInt(character_id),
                    item_code
                },
                data: {
                    quantity: { decrement: 1 }
                }
            });
        }

        res.status(200).json({ message: '아이템 장착 성공', updated_character: updatedCharacter });
    } catch (error) {
        console.error('아이템 장착 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 장착 중 오류가 발생했습니다.' });
    }
});

//캐릭터 아이템 조회
router.get('/characters/:character_id/items', async (req, res) => {
    const { character_id } = req.params;
    try {
        // 캐릭터가 장착한 아이템 목록 조회
        const characterItems = await prisma.characterItem.findMany({
            where: { characterId: parseInt(character_id) },
            include: {
                Item: { // 아이템 정보 포함
                    select: {
                        item_code: true,
                        item_name: true
                    }
                }
            }
        });

        // 아이템 정보만 추출
        const items = characterItems.map(ci => ({
            item_code: ci.Item.item_code,
            item_name: ci.Item.item_name
        }));

        res.status(200).json(items);
    } catch (error) {
        console.error('아이템 목록 조회 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 목록 조회 중 오류가 발생했습니다.' });
    }
});

//장비 해제
router.post('/characters/:character_id/detach', authMiddleware, async (req, res) => {
    const { character_id } = req.params;
    const { item_code } = req.body;

    // 아이템 코드가 유효한지 체크
    if (typeof item_code !== 'number') {
        return res.status(400).json({ message: '유효한 아이템 코드가 필요합니다.' });
    }

    try {
        // 캐릭터와 장착된 아이템을 포함하여 조회
        const character = await prisma.character.findUnique({
            where: { id: parseInt(character_id) },
            include: { items: true }
        });

        if (!character) {
            return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        }

        // 장착된 아이템에서 탈착할 아이템 찾기
        const equippedItem = character.items.find(item => item.itemCode === item_code);
        
        if (!equippedItem) {
            return res.status(404).json({ message: '장착된 아이템이 아닙니다.' });
        }

        // 아이템 데이터 조회
        const itemData = await prisma.item.findUnique({
            where: { item_code }
        });

        if (!itemData) {
            return res.status(404).json({ message: '아이템 정보를 찾을 수 없습니다.' });
        }

        // 캐릭터 스탯 업데이트 (아이템의 스탯만큼 감소)
        const updatedCharacter = await prisma.character.update({
            where: { id: parseInt(character_id) },
            data: {
                health: { decrement: itemData.item_stat.health || 0 },
                power: { decrement: itemData.item_stat.power || 0 }
            }
        });

        // 캐릭터-아이템 테이블에서 해당 아이템 삭제
        await prisma.characterItem.delete({
            where: {
                characterId_itemCode: {
                    characterId: parseInt(character_id),
                    itemCode: item_code
                }
            }
        });

        // 인벤토리에서 아이템 정보 찾기
        const inventoryItem = await prisma.inventory.findFirst({
            where: {
                character_id: parseInt(character_id),
                item_code
            }
        });

        if (!inventoryItem) {
            // 인벤토리에 아이템이 없는 경우 새로 추가
            await prisma.inventory.create({
                data: {
                    character_id: parseInt(character_id),
                    item_code,
                    quantity: 1
                }
            });
        } else {
            // 인벤토리에 아이템이 있는 경우 수량 증가
            await prisma.inventory.update({
                where: {
                    id: inventoryItem.id // inventoryItem의 id를 사용
                },
                data: {
                    quantity: { increment: 1 }
                }
            });
        }

        res.status(200).json({ message: '아이템 탈착 성공', updated_character: updatedCharacter });
    } catch (error) {
        console.error('아이템 탈착 중 오류 발생:', error);
        res.status(500).json({ message: '아이템 탈착 중 오류가 발생했습니다.' });
    }
});

router.post('/characters/:character_id/earn-money', authMiddleware, async (req, res) => {
    const { character_id } = req.params;

    try {
        // 캐릭터 조회
        const character = await prisma.character.findUnique({
            where: { id: parseInt(character_id) }
        });

        if (!character) {
            return res.status(404).json({ message: '캐릭터를 찾을 수 없습니다.' });
        }

        // 게임 머니 증가 (100원 추가)
        const updatedCharacter = await prisma.character.update({
            where: { id: parseInt(character_id) },
            data: {
                money: { increment: 100 }
            }
        });

        res.status(200).json({ message: '게임 머니 증가 성공', current_money: updatedCharacter.money });
    } catch (error) {
        console.error('게임 머니 증가 중 오류 발생:', error);
        res.status(500).json({ message: '게임 머니 증가 중 오류가 발생했습니다.' });
    }
});

export default router;
