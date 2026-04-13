function generateSKU(category, color) {
    const randomNumbers = Math.floor(1000 + Math.random() * 9000);
    return `${category.toUpperCase().slice(0, 3)}-${color.toUpperCase().slice(0, 3)}-${randomNumbers}`;
}

module.exports = { generateSKU };