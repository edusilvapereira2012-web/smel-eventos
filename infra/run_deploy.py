import pexpect
import sys
import os

def deploy():
    # Make sure we are in the project root to run deploy.sh
    os.chmod('infra/deploy.sh', 0o755)
    
    print("🚀 Starting deployment wrapper using pexpect...")
    child = pexpect.spawn('./infra/deploy.sh', encoding='utf-8')
    child.logfile = sys.stdout

    prompts = [
        r"Are you sure you want to continue connecting",
        r"administrator@190.2.72.72's password:",
        r"\[sudo\] password for administrator:"
    ]

    while True:
        try:
            # Wait for ssh/scp password prompts, yes/no confirmation, EOF or Timeout (5 mins)
            index = child.expect(prompts + [pexpect.EOF, pexpect.TIMEOUT], timeout=300)
            
            if index == 0:
                print(" (Answering yes to fingerprint check)")
                child.sendline('yes')
            elif index == 1 or index == 2:
                child.sendline('=V1LT2R._00')
            elif index == 3:
                # EOF reached, process finished
                break
            elif index == 4:
                # Timeout occurred
                print("\n❌ Timeout occurred during deployment.")
                break
        except Exception as e:
            print(f"\n❌ Exception during pexpect run: {str(e)}")
            break

if __name__ == '__main__':
    deploy()
