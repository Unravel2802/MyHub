import { PrepTracker } from "@/src/modules/prep/components/PrepTracker";
import { LeetCodeTracker } from "@/src/modules/leetcode/components/LeetCodeTracker";

export default function PrepPage() {
  return (
    <PrepTracker>
      <LeetCodeTracker />
    </PrepTracker>
  );
}
