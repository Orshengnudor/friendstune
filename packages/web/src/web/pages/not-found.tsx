import { Link } from "wouter";
import { Shell } from "../components/shell";
import { Btn, Empty, Panel } from "../components/kit";

export default function NotFound() {
  return (
    <Shell>
      <Panel className="mt-10">
        <Empty
          title="Nothing tuned to this frequency"
          detail="That page doesn't exist. The radio is still on, though."
          action={
            <div className="flex gap-2">
              <Link href="/">
                <Btn variant="primary">back to radio</Btn>
              </Link>
              <Link href="/explore">
                <Btn>explore friends</Btn>
              </Link>
            </div>
          }
        />
      </Panel>
    </Shell>
  );
}
