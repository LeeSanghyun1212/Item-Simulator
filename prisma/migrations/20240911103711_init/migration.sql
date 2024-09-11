-- CreateTable
CREATE TABLE `Item` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `item_code` INTEGER NOT NULL,
    `item_name` VARCHAR(191) NOT NULL,
    `item_stat` JSON NOT NULL,
    `item_price` INTEGER NOT NULL,

    UNIQUE INDEX `Item_item_code_key`(`item_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
