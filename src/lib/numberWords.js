const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

// A count as a heading word: "Seven" up to twelve, plain digits after that.
export function countWord(count) {
  return WORDS[count] ?? String(count);
}
