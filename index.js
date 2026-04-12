function generateSKU(category, color) {
    const randomNumbers = Math.floor(1000 + Math.random() * 9000);
    return `${category.toUpperCase().slice(0, 3)}-${color.toUpperCase().slice(0, 3)}-${randomNumbers}`;
}

// Example usage:
console.log(generateSKU('Electronics', 'Red'));  // e.g. ELE-RED-1498
console.log(generateSKU('Clothing', 'Blue'));    // e.g. CLO-BLU-1104