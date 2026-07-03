# titleCase(str)

Convert a string to title case.

Rules:

1. A **word** is a maximal run of ASCII letters (`a`–`z`, `A`–`Z`). Everything that is not a letter
   (spaces, digits, punctuation, hyphens, apostrophes) is a **separator** and must be preserved exactly
   as-is, including runs of consecutive separators.
2. For each word: its **first** letter becomes UPPERCASE, and **every other letter in that word becomes
   lowercase**.

Example:

- `titleCase('hello   there, friend')` → `'Hello   There, Friend'`
