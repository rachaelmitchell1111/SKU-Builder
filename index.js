function generateSKU(category, color) {
    const randomNumbers = Math.floor(1000 + Math.random() * 9000);
    return `${category}-${color}-${randomNumbers}`;
}

// Example usage:
console.log(generateSKU('Electronics', 'Red')); // Output: Electronics-Red-XXXX (where XXXX are random numbers)