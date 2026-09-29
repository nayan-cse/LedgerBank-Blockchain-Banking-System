// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
// Test-only adversarial receivers; not deployed by npm start.
interface IBank {
    function registerCustomer(bytes32) external;
    function openAccount() external;
    function deposit(bytes32,bytes32) external payable;
    function withdraw(uint256,bytes32,bytes32) external;
}
contract AdversarialCustomer {
    IBank public bank;
    bool public rejectPayment;
    bool public attack;
    bool public reentrySucceeded;
    constructor(address target) { bank = IBank(target); }
    function enroll() external { bank.registerCustomer(keccak256("test actor")); bank.openAccount(); }
    function fund(bytes32 id) external payable { bank.deposit{value:msg.value}(id,bytes32(0)); }
    function configure(bool reject, bool reenter) external { rejectPayment=reject;attack=reenter; }
    function take(uint256 amount,bytes32 id) external { bank.withdraw(amount,id,bytes32(0)); }
    receive() external payable {
        require(!rejectPayment,"Receiver rejects payment");
        if(attack) {
            attack=false;
            try bank.withdraw(1,keccak256("recursive request"),bytes32(0)) { reentrySucceeded=true; } catch {}
        }
    }
}
contract ForceEther {
    constructor() payable {}
    function force(address payable target) external { selfdestruct(target); }
}
