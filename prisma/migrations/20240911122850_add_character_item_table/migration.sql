-- CreateTable
CREATE TABLE `CharacterItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `characterId` INTEGER NOT NULL,
    `itemCode` INTEGER NOT NULL,

    UNIQUE INDEX `CharacterItem_characterId_itemCode_key`(`characterId`, `itemCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CharacterItem` ADD CONSTRAINT `CharacterItem_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `Character`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CharacterItem` ADD CONSTRAINT `CharacterItem_itemCode_fkey` FOREIGN KEY (`itemCode`) REFERENCES `Item`(`item_code`) ON DELETE RESTRICT ON UPDATE CASCADE;
