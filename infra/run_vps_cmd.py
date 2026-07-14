import pexpect
import sys

def run_vps_cmd(cmd):
    child = pexpect.spawn(f'ssh -t administrator@190.2.72.72 "{cmd}"', encoding='utf-8')
    child.logfile = sys.stdout
    
    prompts = [
        r"administrator@190.2.72.72's password:",
        r"\[sudo\] password for administrator:"
    ]
    
    while True:
        try:
            index = child.expect(prompts + [pexpect.EOF, pexpect.TIMEOUT], timeout=30)
            if index == 0 or index == 1:
                child.sendline('=V1LT2R._00')
            elif index == 2:
                break
            elif index == 3:
                print("\n❌ Timeout")
                break
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            break

if __name__ == '__main__':
    if len(sys.argv) > 1:
        run_vps_cmd(sys.argv[1])
    else:
        print("Please provide a command to run.")
