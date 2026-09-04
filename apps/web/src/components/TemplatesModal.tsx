import { useState } from "react";
import type { LanguageId } from "@compiler-companion/shared";

interface CodeTemplate {
  id: string;
  title: string;
  category: "Starter" | "Searching" | "Graphs" | "Data Structures" | "Dynamic Programming";
  language: LanguageId;
  description: string;
  code: string;
}

const TEMPLATES: CodeTemplate[] = [
  // C++ Templates
  {
    id: "cpp-fast-io",
    title: "Fast I/O & CP Starter",
    category: "Starter",
    language: "cpp",
    description: "Standard competitive programming boilerplate with fast I/O and common macros.",
    code: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <unordered_map>

using namespace std;

void solve() {
    int n;
    if (!(cin >> n)) return;
    vector<int> a(n);
    for (int i = 0; i < n; i++) cin >> a[i];

    cout << "Processed " << n << " elements." << endl;
}

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    int t = 1;
    // cin >> t; // Uncomment for multi-testcases
    while (t--) {
        solve();
    }
    return 0;
}
`,
  },
  {
    id: "cpp-binary-search",
    title: "Binary Search Template",
    category: "Searching",
    language: "cpp",
    description: "Standard binary search returning the target index or -1.",
    code: `#include <iostream>
#include <vector>

using namespace std;

int binarySearch(const vector<int>& arr, int target) {
    int low = 0, high = (int)arr.size() - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        if (arr[mid] == target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}

int main() {
    vector<int> nums = {1, 3, 5, 7, 9, 11, 15, 20};
    int target = 9;
    int idx = binarySearch(nums, target);
    cout << "Target " << target << " found at index: " << idx << endl;
    return 0;
}
`,
  },
  {
    id: "cpp-graph-bfs-dfs",
    title: "Graph BFS & DFS (Adjacency List)",
    category: "Graphs",
    language: "cpp",
    description:
      "Graph traversal implementation using adjacency list, recursion (DFS) and queue (BFS).",
    code: `#include <iostream>
#include <vector>
#include <queue>

using namespace std;

class Graph {
    int V;
    vector<vector<int>> adj;

    void dfsHelper(int u, vector<bool>& visited) {
        visited[u] = true;
        cout << u << " ";
        for (int v : adj[u]) {
            if (!visited[v]) dfsHelper(v, visited);
        }
    }

public:
    Graph(int v) : V(v), adj(v) {}

    void addEdge(int u, int v) {
        adj[u].push_back(v);
        adj[v].push_back(u); // Undirected graph
    }

    void dfs(int start) {
        vector<bool> visited(V, false);
        cout << "DFS: ";
        dfsHelper(start, visited);
        cout << endl;
    }

    void bfs(int start) {
        vector<bool> visited(V, false);
        queue<int> q;
        visited[start] = true;
        q.push(start);

        cout << "BFS: ";
        while (!q.empty()) {
            int u = q.front();
            q.pop();
            cout << u << " ";
            for (int v : adj[u]) {
                if (!visited[v]) {
                    visited[v] = true;
                    q.push(v);
                }
            }
        }
        cout << endl;
    }
};

int main() {
    Graph g(5);
    g.addEdge(0, 1);
    g.addEdge(0, 2);
    g.addEdge(1, 3);
    g.addEdge(2, 4);

    g.dfs(0);
    g.bfs(0);
    return 0;
}
`,
  },
  {
    id: "cpp-linked-list",
    title: "Singly Linked List Implementation",
    category: "Data Structures",
    language: "cpp",
    description: "Standard node structure, push back, reverse, and print operations.",
    code: `#include <iostream>

using namespace std;

struct Node {
    int val;
    Node* next;
    Node(int x) : val(x), next(nullptr) {}
};

void insertTail(Node*& head, int val) {
    if (!head) {
        head = new Node(val);
        return;
    }
    Node* cur = head;
    while (cur->next) cur = cur->next;
    cur->next = new Node(val);
}

Node* reverseList(Node* head) {
    Node* prev = nullptr;
    Node* cur = head;
    while (cur) {
        Node* nxt = cur->next;
        cur->next = prev;
        prev = cur;
        cur = nxt;
    }
    return prev;
}

void printList(Node* head) {
    Node* cur = head;
    while (cur) {
        cout << cur->val << (cur->next ? " -> " : "");
        cur = cur->next;
    }
    cout << endl;
}

int main() {
    Node* head = nullptr;
    insertTail(head, 10);
    insertTail(head, 20);
    insertTail(head, 30);
    insertTail(head, 40);

    cout << "Original: ";
    printList(head);

    head = reverseList(head);
    cout << "Reversed: ";
    printList(head);
    return 0;
}
`,
  },
  {
    id: "cpp-dp-memo",
    title: "2D Dynamic Programming Memoization",
    category: "Dynamic Programming",
    language: "cpp",
    description:
      "Classic 0/1 Knapsack problem template using top-down recursion with memoization table.",
    code: `#include <iostream>
#include <vector>
#include <algorithm>

using namespace std;

int knapsack(int i, int W, const vector<int>& wt, const vector<int>& val, vector<vector<int>>& memo) {
    if (i == 0 || W == 0) return 0;
    if (memo[i][W] != -1) return memo[i][W];

    if (wt[i - 1] > W) {
        return memo[i][W] = knapsack(i - 1, W, wt, val, memo);
    }
    int includeItem = val[i - 1] + knapsack(i - 1, W - wt[i - 1], wt, val, memo);
    int excludeItem = knapsack(i - 1, W, wt, val, memo);
    return memo[i][W] = max(includeItem, excludeItem);
}

int main() {
    vector<int> val = {60, 100, 120};
    vector<int> wt = {10, 20, 30};
    int W = 50;
    int n = (int)val.size();

    vector<vector<int>> memo(n + 1, vector<int>(W + 1, -1));
    cout << "Max Knapsack Value: " << knapsack(n, W, wt, val, memo) << endl;
    return 0;
}
`,
  },

  // Python Templates
  {
    id: "py-fast-io",
    title: "Fast I/O & CP Starter",
    category: "Starter",
    language: "python",
    description: "High-speed input reading and common collection imports.",
    code: `import sys

def solve():
    input = sys.stdin.readline
    lines = sys.stdin.read().split()
    if not lines:
        return
    
    n = int(lines[0])
    arr = [int(x) for x in lines[1:n+1]]
    
    print(f"Processed {len(arr)} numbers. Sum = {sum(arr)}")

if __name__ == "__main__":
    solve()
`,
  },
  {
    id: "py-binary-search",
    title: "Binary Search (Iterative)",
    category: "Searching",
    language: "python",
    description: "Standard binary search implementation in Python with bisect comparison.",
    code: `def binary_search(arr, target):
    low, high = 0, len(arr) - 1
    while low <= high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return -1

if __name__ == "__main__":
    data = [2, 4, 6, 8, 10, 12, 14, 16]
    target = 10
    idx = binary_search(data, target)
    print(f"Target {target} found at index {idx}")
`,
  },
  {
    id: "py-graph-bfs-dfs",
    title: "Graph BFS & DFS with deque",
    category: "Graphs",
    language: "python",
    description: "Graph traversals using dictionary adjacency lists and collections.deque.",
    code: `from collections import deque

def bfs(graph, start):
    visited = {start}
    queue = deque([start])
    order = []
    while queue:
        node = queue.popleft()
        order.append(node)
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return order

def dfs(graph, start, visited=None):
    if visited is None:
        visited = set()
    visited.add(start)
    order = [start]
    for neighbor in graph.get(start, []):
        if neighbor not in visited:
            order.extend(dfs(graph, neighbor, visited))
    return order

if __name__ == "__main__":
    g = {
        0: [1, 2],
        1: [0, 3],
        2: [0, 4],
        3: [1],
        4: [2]
    }
    print("BFS Order:", bfs(g, 0))
    print("DFS Order:", dfs(g, 0))
`,
  },
  {
    id: "py-heap-priority-queue",
    title: "Min-Heap & Max-Heap with heapq",
    category: "Data Structures",
    language: "python",
    description: "Priority queue operations, Top-K elements, and frequency heaps.",
    code: `import heapq

def top_k_frequent(nums, k):
    # Count frequencies
    freq = {}
    for num in nums:
        freq[num] = freq.get(num, 0) + 1
        
    # Maintain a min-heap of size k
    heap = []
    for num, count in freq.items():
        heapq.heappush(heap, (count, num))
        if len(heap) > k:
            heapq.heappop(heap)
            
    return [num for count, num in heap]

if __name__ == "__main__":
    arr = [1, 1, 1, 2, 2, 3, 4, 4, 4, 4]
    print("Top 2 frequent:", top_k_frequent(arr, 2))
`,
  },
  {
    id: "py-dp-memo",
    title: "DP with @functools.lru_cache",
    category: "Dynamic Programming",
    language: "python",
    description: "Clean top-down Dynamic Programming using Python's built-in LRU cache.",
    code: `from functools import lru_cache

@lru_cache(maxsize=None)
def longest_common_subsequence(s1: str, s2: str, i: int = 0, j: int = 0) -> int:
    if i == len(s1) or j == len(s2):
        return 0
    if s1[i] == s2[j]:
        return 1 + longest_common_subsequence(s1, s2, i + 1, j + 1)
    return max(
        longest_common_subsequence(s1, s2, i + 1, j),
        longest_common_subsequence(s1, s2, i, j + 1)
    )

if __name__ == "__main__":
    word1 = "abcde"
    word2 = "ace"
    print(f"LCS of '{word1}' and '{word2}' is: {longest_common_subsequence(word1, word2)}")
`,
  },
];

interface TemplatesModalProps {
  isOpen: boolean;
  currentLanguage: LanguageId;
  onSelectTemplate: (code: string) => void;
  onClose: () => void;
}

export function TemplatesModal({
  isOpen,
  currentLanguage,
  onSelectTemplate,
  onClose,
}: TemplatesModalProps) {
  const [langFilter, setLangFilter] = useState<LanguageId>(currentLanguage || "cpp");
  const filteredTemplates = TEMPLATES.filter((t) => t.language === langFilter);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    () => filteredTemplates[0]?.id ?? "",
  );

  if (!isOpen) return null;

  const activeTemplate =
    filteredTemplates.find((t) => t.id === selectedTemplateId) ?? filteredTemplates[0];

  const handleApply = () => {
    if (!activeTemplate) return;
    const confirm = window.confirm(
      `Insert template "${activeTemplate.title}" into the editor? (This will overwrite current editor contents)`,
    );
    if (!confirm) return;
    onSelectTemplate(activeTemplate.code);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="templates-modal-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="templates-modal-header">
          <div className="templates-title">
            <span className="templates-icon">📚</span>
            <div>
              <h3>DSA & Lab Starter Templates</h3>
              <small>Ready-to-use competitive programming and assignment boilerplates</small>
            </div>
          </div>

          <div className="templates-lang-toggle">
            <button
              type="button"
              className={`lang-tab-btn ${langFilter === "cpp" ? "active" : ""}`}
              onClick={() => {
                setLangFilter("cpp");
                const firstCpp = TEMPLATES.find((t) => t.language === "cpp");
                if (firstCpp) setSelectedTemplateId(firstCpp.id);
              }}
            >
              C++
            </button>
            <button
              type="button"
              className={`lang-tab-btn ${langFilter === "python" ? "active" : ""}`}
              onClick={() => {
                setLangFilter("python");
                const firstPy = TEMPLATES.find((t) => t.language === "python");
                if (firstPy) setSelectedTemplateId(firstPy.id);
              }}
            >
              Python
            </button>
          </div>

          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="templates-modal-body">
          {/* Left list of templates */}
          <div className="templates-list-pane">
            {filteredTemplates.map((t) => (
              <div
                key={t.id}
                className={`template-list-item ${t.id === activeTemplate?.id ? "selected" : ""}`}
                onClick={() => setSelectedTemplateId(t.id)}
              >
                <div className="template-item-header">
                  <strong>{t.title}</strong>
                  <span className="template-category-badge">{t.category}</span>
                </div>
                <p className="template-item-desc">{t.description}</p>
              </div>
            ))}
          </div>

          {/* Right code preview pane */}
          <div className="templates-preview-pane">
            {activeTemplate ? (
              <>
                <div className="template-preview-header">
                  <div>
                    <strong>{activeTemplate.title}</strong>
                    <small>{activeTemplate.description}</small>
                  </div>
                  <button type="button" className="apply-template-btn" onClick={handleApply}>
                    ✦ Insert into Editor
                  </button>
                </div>
                <pre className="template-code-pre">{activeTemplate.code}</pre>
              </>
            ) : (
              <div className="template-empty-preview">
                <p>Select a template on the left to preview.</p>
              </div>
            )}
          </div>
        </div>

        <div className="templates-modal-footer">
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
