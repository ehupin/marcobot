let a = 123.4567890

let decimals = Number("1.5")
let adjustedAmount = Math.trunc(a * (1/decimals))*decimals

console.log(adjustedAmount)

