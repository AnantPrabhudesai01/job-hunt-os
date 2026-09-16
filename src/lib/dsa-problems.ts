// DSA curriculum: curated starter set matched to fresher role stacks
// (arrays/strings/hashmaps for frontend-leaning roles, SQL for data-adjacent
// ones). CLIENT-SAFE static list — solves live in dsa_solves with verdicts.

export type DsaProblem = {
  title: string;
  topic: string;
  pattern: string;
  difficulty: "Easy" | "Medium" | "Hard";
};

export const DSA_CURRICULUM: DsaProblem[] = [
  { title: "Two Sum", topic: "Arrays", pattern: "Hashmap", difficulty: "Easy" },
  { title: "Best Time to Buy and Sell Stock", topic: "Arrays", pattern: "Sliding window", difficulty: "Easy" },
  { title: "Contains Duplicate", topic: "Arrays", pattern: "Hashmap", difficulty: "Easy" },
  { title: "Maximum Subarray", topic: "Arrays", pattern: "Kadane", difficulty: "Medium" },
  { title: "Product of Array Except Self", topic: "Arrays", pattern: "Prefix/suffix", difficulty: "Medium" },
  { title: "Valid Anagram", topic: "Strings", pattern: "Counting", difficulty: "Easy" },
  { title: "Valid Parentheses", topic: "Strings", pattern: "Stack", difficulty: "Easy" },
  { title: "Longest Substring Without Repeating", topic: "Strings", pattern: "Sliding window", difficulty: "Medium" },
  { title: "Group Anagrams", topic: "Strings", pattern: "Hashmap", difficulty: "Medium" },
  { title: "Two Sum II (Sorted)", topic: "Two Pointers", pattern: "Two pointers", difficulty: "Easy" },
  { title: "Container With Most Water", topic: "Two Pointers", pattern: "Two pointers", difficulty: "Medium" },
  { title: "Valid Palindrome", topic: "Two Pointers", pattern: "Two pointers", difficulty: "Easy" },
  { title: "Min Stack", topic: "Stack", pattern: "Stack", difficulty: "Medium" },
  { title: "Reverse Linked List", topic: "Linked List", pattern: "Iteration", difficulty: "Easy" },
  { title: "Merge Two Sorted Lists", topic: "Linked List", pattern: "Merge", difficulty: "Easy" },
  { title: "Binary Search", topic: "Search", pattern: "Binary search", difficulty: "Easy" },
  { title: "Search in Rotated Sorted Array", topic: "Search", pattern: "Binary search", difficulty: "Medium" },
  { title: "Climbing Stairs", topic: "DP", pattern: "DP basics", difficulty: "Easy" },
  { title: "SELECT with WHERE + ORDER BY", topic: "SQL", pattern: "Filtering", difficulty: "Easy" },
  { title: "JOINs: INNER vs LEFT", topic: "SQL", pattern: "Joins", difficulty: "Easy" },
  { title: "GROUP BY + HAVING", topic: "SQL", pattern: "Aggregation", difficulty: "Medium" },
  { title: "Second Highest Salary", topic: "SQL", pattern: "Subquery", difficulty: "Medium" },
  { title: "Debounce a Search Input", topic: "JS Frontend", pattern: "Timing", difficulty: "Easy" },
  { title: "Flatten Nested Array", topic: "JS Frontend", pattern: "Recursion", difficulty: "Easy" },
];
