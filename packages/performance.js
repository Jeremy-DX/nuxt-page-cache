module.exports = {
  sizeof(str, charset) {
    let total = 0
    let charCode
    let i
    let len
    charset = charset ? charset.toLowerCase() : ''
    if (charset === 'utf-16' || charset === 'utf16') {
      for (i = 0, len = str.length; i < len; i++) {
        charCode = str.charCodeAt(i)
        if (charCode <= 0xFFFF) {
          total += 2
        } else {
          total += 4
        }
      }
    } else {
      for (i = 0, len = str.length; i < len; i++) {
        charCode = str.charCodeAt(i)
        if (charCode <= 0x007F) {
          total += 1
        } else if (charCode <= 0x07FF) {
          total += 2
        } else if (charCode <= 0xFFFF) {
          total += 3
        } else {
          total += 4
        }
      }
    }
    return total / 1024
  }

}
